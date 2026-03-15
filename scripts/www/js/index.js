// ============ 配置信息 ============
const productId = "YSrJ9TY9w1";
const deviceName = "SmartOutlet";
const authToken = "version=2022-05-01&res=userid%2F491619&et=2132888183&method=sha1&sign=3JAzFxRYL1vZHg07BHFrQTp0blc%3D";
const API_BASE = "https://iot-api.heclouds.com";

const MAX_FETCH_POINTS = 1000000;

let socketState = false;
let autoPriceState = false;
let lowPowerState = false;
let currentTimeRange = 1;
let currentHistoryAttr = 'voltage';

const sensorElements = {
    voltage: document.getElementById('voltage'),
    current: document.getElementById('current'),
    power: document.getElementById('power'),
    tem: document.getElementById('tem'),
    humi: document.getElementById('humi'),
    total_energy: document.getElementById('total_energy')
};

const thresholdElements = {
    voltageMax: {
        slider: document.getElementById('voltageMaxSlider'),
        input: document.getElementById('voltageMaxInput'),
        display: document.getElementById('voltageMaxDisplay'),
        setBtn: document.getElementById('voltageMaxSetBtn')
    },
    currentMax: {
        slider: document.getElementById('currentMaxSlider'),
        input: document.getElementById('currentMaxInput'),
        display: document.getElementById('currentMaxDisplay'),
        setBtn: document.getElementById('currentMaxSetBtn')
    },
    powerMax: {
        slider: document.getElementById('powerMaxSlider'),
        input: document.getElementById('powerMaxInput'),
        display: document.getElementById('powerMaxDisplay'),
        setBtn: document.getElementById('powerMaxSetBtn')
    },
    currentPrice: {
        slider: document.getElementById('currentPriceSlider'),
        input: document.getElementById('currentPriceInput'),
        display: document.getElementById('currentPriceDisplay'),
        setBtn: document.getElementById('currentPriceSetBtn')
    },
    priceThreshold: {
        slider: document.getElementById('priceThresholdSlider'),
        input: document.getElementById('priceThresholdInput'),
        display: document.getElementById('priceThresholdDisplay'),
        setBtn: document.getElementById('priceThresholdSetBtn')
    },
    powerLowThreshold: {
        slider: document.getElementById('powerLowThresholdSlider'),
        input: document.getElementById('powerLowThresholdInput'),
        display: document.getElementById('powerLowThresholdDisplay'),
        setBtn: document.getElementById('powerLowThresholdSetBtn')
    },
    lowPowerDuration: {
        slider: document.getElementById('lowPowerDurationSlider'),
        input: document.getElementById('lowPowerDurationInput'),
        display: document.getElementById('lowPowerDurationDisplay'),
        setBtn: document.getElementById('lowPowerDurationSetBtn')
    }
};

const switchBtn = document.getElementById('socketSwitch');
const autoPriceBtn = document.getElementById('autoPriceSwitch');
const lowPowerBtn = document.getElementById('lowPowerSwitch');

const historyAttrBtns = document.querySelectorAll('.history-attr-btn');
const historyTimeBtns = document.querySelectorAll('.history-time-btn');
const historyChartDiv = document.getElementById('historyChart');
const historyLoading = document.getElementById('historyLoading');
const peakValueSpan = document.getElementById('peakValue');
const peakUnitSpan = document.getElementById('peakUnit');
const peakTimeSpan = document.getElementById('peakTime');
const startTimeInput = document.getElementById('startTimeInput');
const endTimeInput = document.getElementById('endTimeInput');
const errorDiv = document.getElementById('errorMsg');
let historyChart = null;

// 更新时间
function updateCurrentTime() {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    document.getElementById('currentTime').textContent = timeStr;
    if (!startTimeInput.value) {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        startTimeInput.value = yesterday.toISOString().slice(0, 16);
    }
    if (!endTimeInput.value) {
        endTimeInput.value = now.toISOString().slice(0, 16);
    }
}

// 工具函数
function showError(msg) {
    errorDiv.style.display = 'block';
    errorDiv.innerText = `❌ ${msg}`;
    setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getTimeRange(days) {
    const now = Date.now();
    return { start: now - days * 86400000, end: now };
}

function datetimeToTimestamp(datetimeStr) {
    return datetimeStr ? new Date(datetimeStr).getTime() : 0;
}

function getUnit(identifier) {
    const unitMap = {
        voltage: 'V', current: 'mA', power: 'W', tem: '°C', humi: '%RH',
        total_energy: 'kWh', current_max: 'mA', voltage_max: 'V', power_max: 'W',
        current_price: '元', price_threshold: '元',
        power_low_threshold: 'W', low_power_duration: '秒',
        socket: '', auto_price_enable: '', low_power_enable: ''
    };
    return unitMap[identifier] || '';
}

function formatEnumValue(value, identifier) {
    if (identifier === 'socket' || identifier === 'auto_price_enable' || identifier === 'low_power_enable') {
        return value == 1 ? '开' : '关';
    }
    return value;
}

// 阈值同步函数
function syncVoltageMaxFromSlider() {
    const val = parseFloat(thresholdElements.voltageMax.slider.value);
    thresholdElements.voltageMax.input.value = val;
    thresholdElements.voltageMax.display.innerText = val.toFixed(1);
}
function syncVoltageMaxFromInput() {
    let val = parseFloat(thresholdElements.voltageMax.input.value);
    if (isNaN(val)) val = 0;
    val = Math.min(500, Math.max(0, val));
    thresholdElements.voltageMax.input.value = val;
    thresholdElements.voltageMax.display.innerText = val.toFixed(1);
    thresholdElements.voltageMax.slider.value = val;
}
function syncCurrentMaxFromSlider() {
    const val = parseInt(thresholdElements.currentMax.slider.value);
    thresholdElements.currentMax.input.value = val;
    thresholdElements.currentMax.display.innerText = val;
}
function syncCurrentMaxFromInput() {
    let val = parseInt(thresholdElements.currentMax.input.value);
    if (isNaN(val)) val = 0;
    val = Math.min(50000, Math.max(0, val));
    thresholdElements.currentMax.input.value = val;
    thresholdElements.currentMax.display.innerText = val;
    thresholdElements.currentMax.slider.value = val;
}
function syncPowerMaxFromSlider() {
    const val = parseFloat(thresholdElements.powerMax.slider.value);
    thresholdElements.powerMax.input.value = val;
    thresholdElements.powerMax.display.innerText = val.toFixed(1);
}
function syncPowerMaxFromInput() {
    let val = parseFloat(thresholdElements.powerMax.input.value);
    if (isNaN(val)) val = 0;
    val = Math.min(5000, Math.max(0, val));
    thresholdElements.powerMax.input.value = val;
    thresholdElements.powerMax.display.innerText = val.toFixed(1);
    thresholdElements.powerMax.slider.value = val;
}
function syncCurrentPriceFromSlider() {
    const val = parseFloat(thresholdElements.currentPrice.slider.value);
    thresholdElements.currentPrice.input.value = val;
    thresholdElements.currentPrice.display.innerText = val.toFixed(2);
}
function syncCurrentPriceFromInput() {
    let val = parseFloat(thresholdElements.currentPrice.input.value);
    if (isNaN(val)) val = 0;
    val = Math.min(10, Math.max(0, val));
    thresholdElements.currentPrice.input.value = val;
    thresholdElements.currentPrice.display.innerText = val.toFixed(2);
    thresholdElements.currentPrice.slider.value = val;
}
function syncPriceThresholdFromSlider() {
    const val = parseFloat(thresholdElements.priceThreshold.slider.value);
    thresholdElements.priceThreshold.input.value = val;
    thresholdElements.priceThreshold.display.innerText = val.toFixed(2);
}
function syncPriceThresholdFromInput() {
    let val = parseFloat(thresholdElements.priceThreshold.input.value);
    if (isNaN(val)) val = 0;
    val = Math.min(10, Math.max(0, val));
    thresholdElements.priceThreshold.input.value = val;
    thresholdElements.priceThreshold.display.innerText = val.toFixed(2);
    thresholdElements.priceThreshold.slider.value = val;
}
function syncPowerLowThresholdFromSlider() {
    const val = parseFloat(thresholdElements.powerLowThreshold.slider.value);
    thresholdElements.powerLowThreshold.input.value = val;
    thresholdElements.powerLowThreshold.display.innerText = val.toFixed(1);
}
function syncPowerLowThresholdFromInput() {
    let val = parseFloat(thresholdElements.powerLowThreshold.input.value);
    if (isNaN(val)) val = 1;
    val = Math.min(2000, Math.max(1, val));
    thresholdElements.powerLowThreshold.input.value = val;
    thresholdElements.powerLowThreshold.display.innerText = val.toFixed(1);
    thresholdElements.powerLowThreshold.slider.value = val;
}
function syncLowPowerDurationFromSlider() {
    const val = parseInt(thresholdElements.lowPowerDuration.slider.value);
    thresholdElements.lowPowerDuration.input.value = val;
    thresholdElements.lowPowerDuration.display.innerText = val;
}
function syncLowPowerDurationFromInput() {
    let val = parseInt(thresholdElements.lowPowerDuration.input.value);
    if (isNaN(val)) val = 1;
    val = Math.min(1200, Math.max(1, val));
    thresholdElements.lowPowerDuration.input.value = val;
    thresholdElements.lowPowerDuration.display.innerText = val;
    thresholdElements.lowPowerDuration.slider.value = val;
}

// 步进按钮函数
function decrementVoltageMax() {
    let currentVal = parseFloat(thresholdElements.voltageMax.slider.value);
    let newVal = Math.max(0, currentVal - 0.1);
    thresholdElements.voltageMax.slider.value = newVal;
    syncVoltageMaxFromSlider();
}
function incrementVoltageMax() {
    let currentVal = parseFloat(thresholdElements.voltageMax.slider.value);
    let newVal = Math.min(500, currentVal + 0.1);
    thresholdElements.voltageMax.slider.value = newVal;
    syncVoltageMaxFromSlider();
}
function decrementCurrentMax() {
    let currentVal = parseInt(thresholdElements.currentMax.slider.value);
    let newVal = Math.max(0, currentVal - 100);
    thresholdElements.currentMax.slider.value = newVal;
    syncCurrentMaxFromSlider();
}
function incrementCurrentMax() {
    let currentVal = parseInt(thresholdElements.currentMax.slider.value);
    let newVal = Math.min(50000, currentVal + 100);
    thresholdElements.currentMax.slider.value = newVal;
    syncCurrentMaxFromSlider();
}
function decrementPowerMax() {
    let currentVal = parseFloat(thresholdElements.powerMax.slider.value);
    let newVal = Math.max(0, currentVal - 1);
    thresholdElements.powerMax.slider.value = newVal;
    syncPowerMaxFromSlider();
}
function incrementPowerMax() {
    let currentVal = parseFloat(thresholdElements.powerMax.slider.value);
    let newVal = Math.min(5000, currentVal + 1);
    thresholdElements.powerMax.slider.value = newVal;
    syncPowerMaxFromSlider();
}
function decrementCurrentPrice() {
    let currentVal = parseFloat(thresholdElements.currentPrice.slider.value);
    let newVal = Math.max(0, currentVal - 0.01);
    thresholdElements.currentPrice.slider.value = newVal;
    syncCurrentPriceFromSlider();
}
function incrementCurrentPrice() {
    let currentVal = parseFloat(thresholdElements.currentPrice.slider.value);
    let newVal = Math.min(10, currentVal + 0.01);
    thresholdElements.currentPrice.slider.value = newVal;
    syncCurrentPriceFromSlider();
}
function decrementPriceThreshold() {
    let currentVal = parseFloat(thresholdElements.priceThreshold.slider.value);
    let newVal = Math.max(0, currentVal - 0.01);
    thresholdElements.priceThreshold.slider.value = newVal;
    syncPriceThresholdFromSlider();
}
function incrementPriceThreshold() {
    let currentVal = parseFloat(thresholdElements.priceThreshold.slider.value);
    let newVal = Math.min(10, currentVal + 0.01);
    thresholdElements.priceThreshold.slider.value = newVal;
    syncPriceThresholdFromSlider();
}
function decrementPowerLowThreshold() {
    let currentVal = parseFloat(thresholdElements.powerLowThreshold.slider.value);
    let newVal = Math.max(1, currentVal - 0.1);
    thresholdElements.powerLowThreshold.slider.value = newVal;
    syncPowerLowThresholdFromSlider();
}
function incrementPowerLowThreshold() {
    let currentVal = parseFloat(thresholdElements.powerLowThreshold.slider.value);
    let newVal = Math.min(2000, currentVal + 0.1);
    thresholdElements.powerLowThreshold.slider.value = newVal;
    syncPowerLowThresholdFromSlider();
}
function decrementLowPowerDuration() {
    let currentVal = parseInt(thresholdElements.lowPowerDuration.slider.value);
    let newVal = Math.max(1, currentVal - 1);
    thresholdElements.lowPowerDuration.slider.value = newVal;
    syncLowPowerDurationFromSlider();
}
function incrementLowPowerDuration() {
    let currentVal = parseInt(thresholdElements.lowPowerDuration.slider.value);
    let newVal = Math.min(1200, currentVal + 1);
    thresholdElements.lowPowerDuration.slider.value = newVal;
    syncLowPowerDurationFromSlider();
}

// API 请求函数
function fetchDeviceData() {
    const url = `${API_BASE}/thingmodel/query-device-property?product_id=${productId}&device_name=${deviceName}`;
    fetch(url, {
        method: 'GET',
        headers: { 'Authorization': authToken, 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.code !== 0) throw new Error(data.msg || '获取设备数据失败');
        const props = data.data || [];
        const propMap = {};
        props.forEach(item => propMap[item.identifier] = item.value);

        Object.keys(sensorElements).forEach(key => {
            if (propMap[key] !== undefined) {
                let value = propMap[key];
                if (key === 'tem' || key === 'humi') value = parseInt(value);
                else if (typeof value === 'string' && !isNaN(parseFloat(value))) value = parseFloat(value).toFixed(1);
                sensorElements[key].innerText = value;
            }
        });

        if (propMap.socket !== undefined) {
            socketState = propMap.socket == 1;
            switchBtn.classList.toggle('on', socketState);
        }
        if (propMap.auto_price_enable !== undefined) {
            autoPriceState = propMap.auto_price_enable == 1;
            autoPriceBtn.classList.toggle('on', autoPriceState);
        }
        if (propMap.low_power_enable !== undefined) {
            lowPowerState = propMap.low_power_enable == 1;
            lowPowerBtn.classList.toggle('on', lowPowerState);
        }

        if (propMap.voltage_max !== undefined) {
            const val = parseFloat(propMap.voltage_max);
            thresholdElements.voltageMax.display.innerText = val.toFixed(1);
            thresholdElements.voltageMax.input.value = val;
            thresholdElements.voltageMax.slider.value = val;
        }
        if (propMap.current_max !== undefined) {
            const val = parseInt(propMap.current_max);
            thresholdElements.currentMax.display.innerText = val;
            thresholdElements.currentMax.input.value = val;
            thresholdElements.currentMax.slider.value = val;
        }
        if (propMap.power_max !== undefined) {
            const val = parseFloat(propMap.power_max);
            thresholdElements.powerMax.display.innerText = val.toFixed(1);
            thresholdElements.powerMax.input.value = val;
            thresholdElements.powerMax.slider.value = val;
        }
        if (propMap.current_price !== undefined) {
            const val = parseFloat(propMap.current_price);
            thresholdElements.currentPrice.display.innerText = val.toFixed(2);
            thresholdElements.currentPrice.input.value = val;
            thresholdElements.currentPrice.slider.value = val;
        }
        if (propMap.price_threshold !== undefined) {
            const val = parseFloat(propMap.price_threshold);
            thresholdElements.priceThreshold.display.innerText = val.toFixed(2);
            thresholdElements.priceThreshold.input.value = val;
            thresholdElements.priceThreshold.slider.value = val;
        }
        if (propMap.power_low_threshold !== undefined) {
            const val = parseFloat(propMap.power_low_threshold);
            thresholdElements.powerLowThreshold.display.innerText = val.toFixed(1);
            thresholdElements.powerLowThreshold.input.value = val;
            thresholdElements.powerLowThreshold.slider.value = val;
        }
        if (propMap.low_power_duration !== undefined) {
            const val = parseInt(propMap.low_power_duration);
            thresholdElements.lowPowerDuration.display.innerText = val;
            thresholdElements.lowPowerDuration.input.value = val;
            thresholdElements.lowPowerDuration.slider.value = val;
        }
    })
    .catch(error => {
        console.error('获取设备数据失败:', error);
        showError(error.message);
    });
}

function sendCommand(params) {
    const url = `${API_BASE}/thingmodel/set-device-desired-property`;
    return fetch(url, {
        method: 'POST',
        headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, device_name: deviceName, params: params })
    })
    .then(response => response.json())
    .then(data => {
        if (data.code !== 0) throw new Error(data.msg || '设置属性失败');
        return data;
    });
}

// 开关控制函数（乐观更新）
function toggleSocket() {
    if (switchBtn.disabled) return;
    const oldState = socketState;
    const newState = !oldState;
    
    socketState = newState;
    switchBtn.classList.toggle('on', newState);
    switchBtn.disabled = true;

    sendCommand({ socket: newState ? 1 : 0 })
        .catch(error => {
            socketState = oldState;
            switchBtn.classList.toggle('on', oldState);
            showError(error.message);
        })
        .finally(() => {
            switchBtn.disabled = false;
        });
}

function toggleAutoPrice() {
    if (autoPriceBtn.disabled) return;
    const oldState = autoPriceState;
    const newState = !oldState;
    
    autoPriceState = newState;
    autoPriceBtn.classList.toggle('on', newState);
    autoPriceBtn.disabled = true;

    sendCommand({ auto_price_enable: newState ? 1 : 0 })
        .catch(error => {
            autoPriceState = oldState;
            autoPriceBtn.classList.toggle('on', oldState);
            showError(error.message);
        })
        .finally(() => {
            autoPriceBtn.disabled = false;
        });
}

function toggleLowPower() {
    if (lowPowerBtn.disabled) return;
    const oldState = lowPowerState;
    const newState = !oldState;
    
    lowPowerState = newState;
    lowPowerBtn.classList.toggle('on', newState);
    lowPowerBtn.disabled = true;

    sendCommand({ low_power_enable: newState ? 1 : 0 })
        .catch(error => {
            lowPowerState = oldState;
            lowPowerBtn.classList.toggle('on', oldState);
            showError(error.message);
        })
        .finally(() => {
            lowPowerBtn.disabled = false;
        });
}

// 阈值设置函数（移除立即刷新，只依赖轮询）
function setVoltageMax() {
    const val = parseFloat(thresholdElements.voltageMax.input.value);
    if (isNaN(val)) return;
    thresholdElements.voltageMax.setBtn.disabled = true;
    sendCommand({ voltage_max: val })
        .catch(error => showError(error.message))
        .finally(() => {
            thresholdElements.voltageMax.setBtn.disabled = false;
        });
}
function setCurrentMax() {
    const val = parseInt(thresholdElements.currentMax.input.value);
    if (isNaN(val)) return;
    thresholdElements.currentMax.setBtn.disabled = true;
    sendCommand({ current_max: val })
        .catch(error => showError(error.message))
        .finally(() => {
            thresholdElements.currentMax.setBtn.disabled = false;
        });
}
function setPowerMax() {
    const val = parseFloat(thresholdElements.powerMax.input.value);
    if (isNaN(val)) return;
    thresholdElements.powerMax.setBtn.disabled = true;
    sendCommand({ power_max: val })
        .catch(error => showError(error.message))
        .finally(() => {
            thresholdElements.powerMax.setBtn.disabled = false;
        });
}
function setCurrentPrice() {
    const val = parseFloat(thresholdElements.currentPrice.input.value);
    if (isNaN(val)) return;
    thresholdElements.currentPrice.setBtn.disabled = true;
    sendCommand({ current_price: val })
        .catch(error => showError(error.message))
        .finally(() => {
            thresholdElements.currentPrice.setBtn.disabled = false;
        });
}
function setPriceThreshold() {
    const val = parseFloat(thresholdElements.priceThreshold.input.value);
    if (isNaN(val)) return;
    thresholdElements.priceThreshold.setBtn.disabled = true;
    sendCommand({ price_threshold: val })
        .catch(error => showError(error.message))
        .finally(() => {
            thresholdElements.priceThreshold.setBtn.disabled = false;
        });
}
function setPowerLowThreshold() {
    const val = parseFloat(thresholdElements.powerLowThreshold.input.value);
    if (isNaN(val)) return;
    thresholdElements.powerLowThreshold.setBtn.disabled = true;
    sendCommand({ power_low_threshold: val })
        .catch(error => showError(error.message))
        .finally(() => {
            thresholdElements.powerLowThreshold.setBtn.disabled = false;
        });
}
function setLowPowerDuration() {
    const val = parseInt(thresholdElements.lowPowerDuration.input.value);
    if (isNaN(val)) return;
    thresholdElements.lowPowerDuration.setBtn.disabled = true;
    sendCommand({ low_power_duration: val })
        .catch(error => showError(error.message))
        .finally(() => {
            thresholdElements.lowPowerDuration.setBtn.disabled = false;
        });
}

// 历史数据获取（分页）
async function fetchHistoryData(identifier, start, end) {
    let allData = [];
    let offset = 0;
    const limit = 2000;
    const now = Date.now();
    try {
        while (true) {
            const params = new URLSearchParams({
                product_id: productId,
                device_name: deviceName,
                identifier: identifier,
                start_time: start.toString(),
                end_time: end.toString(),
                limit: limit.toString(),
                offset: offset.toString(),
                sort: '1'
            });
            const url = `${API_BASE}/thingmodel/query-device-property-history?${params}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const result = await response.json();
            if (result.code !== 0) throw new Error(result.msg || '历史数据获取失败');
            const list = result.data?.list || [];
            if (list.length === 0) break;
            const formattedData = list.map(item => ({
                time: item.time,
                value: item.identifier === 'socket' || item.identifier === 'auto_price_enable' || item.identifier === 'low_power_enable'
                    ? parseInt(item.value) : parseFloat(item.value) || 0
            }));
            allData = allData.concat(formattedData);
            if (allData.length >= MAX_FETCH_POINTS) {
                console.warn(`数据量过大，已截断至${MAX_FETCH_POINTS}条`);
                showError(`数据量过大，仅显示部分数据（最多${MAX_FETCH_POINTS}条）`);
                break;
            }
            const lastDataTime = formattedData[formattedData.length - 1].time;
            if (lastDataTime >= now) break;
            if (list.length < limit) break;
            offset += limit;
            await delay(10);
        }
        return allData.sort((a, b) => a.time - b.time);
    } catch (error) {
        console.error(`获取${identifier}历史数据失败:`, error);
        showError(`加载${identifier}历史数据失败: ${error.message}`);
        return [];
    }
}

// 峰值信息更新
function updatePeakInfo(data, identifier) {
    if (!data || data.length === 0) {
        peakValueSpan.innerText = '--';
        peakUnitSpan.innerText = '';
        peakTimeSpan.innerText = '--';
        return;
    }
    if (identifier === 'socket' || identifier === 'auto_price_enable' || identifier === 'low_power_enable') {
        const onCount = data.filter(item => item.value === 1).length;
        const offCount = data.length - onCount;
        peakValueSpan.innerText = `开:${onCount}次/关:${offCount}次`;
        peakUnitSpan.innerText = '';
        const lastChange = data[data.length - 1];
        const d = new Date(lastChange.time);
        const timeStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        peakTimeSpan.innerText = `最后状态:${formatEnumValue(lastChange.value, identifier)} ${timeStr}`;
        return;
    }
    let maxValue = -Infinity;
    let maxTime = data[0].time;
    for (let point of data) {
        if (point.value > maxValue) {
            maxValue = point.value;
            maxTime = point.time;
        }
    }
    const unit = getUnit(identifier);
    const d = new Date(maxTime);
    const timeStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    peakValueSpan.innerText = maxValue.toFixed(2);
    peakUnitSpan.innerText = unit;
    peakTimeSpan.innerText = timeStr;
}

// 数据聚合
function aggregateDataByTime(data, identifier, intervalMs) {
    if (identifier === 'socket' || identifier === 'auto_price_enable' || identifier === 'low_power_enable') {
        return data;
    }
    if (data.length === 0) return [];
    const bucketMap = new Map();
    for (const point of data) {
        const bucketStart = Math.floor(point.time / intervalMs) * intervalMs;
        bucketMap.set(bucketStart, point);
    }
    const aggregated = Array.from(bucketMap.values());
    return aggregated.sort((a, b) => a.time - b.time);
}

// 计算差分数据（用于累计用电）
function computeDiffData(data, days) {
    if (data.length < 2) return data;
    const diff = [];
    diff.push({ time: data[0].time, value: 0 });
    for (let i = 1; i < data.length; i++) {
        diff.push({
            time: data[i].time,
            value: Math.max(0, data[i].value - data[i-1].value)
        });
    }
    return diff;
}

// 渲染图表
function renderHistoryChart(data, identifier, days = currentTimeRange, isDiffed = false) {
    if (!historyChart) {
        historyChart = echarts.init(historyChartDiv);
    }

    if (!data || data.length === 0) {
        historyChart.setOption({
            title: { text: '暂无数据', left: 'center', top: 'center' },
            xAxis: { data: [] },
            yAxis: {},
            series: []
        });
        return;
    }

    const times = data.map(p => {
        const d = new Date(p.time);
        if (days === 1) {
            return `${d.getHours().toString().padStart(2,'0')}:00`;
        } else if (days === 7) {
            return `${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
        } else {
            return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        }
    });
    
    let seriesData = data.map(p => p.value);
    let seriesName = identifier;
    let unit = getUnit(identifier);
    
    if (identifier === 'total_energy' && !isDiffed) {
        if (data.length >= 2) {
            const diff = computeDiffData(data, days);
            seriesData = diff.map(p => p.value);
            seriesName = (days === 1) ? '每小时用电量' : '日用电量';
            unit = 'kWh';
        }
    } else if (identifier === 'total_energy' && isDiffed) {
        seriesName = (days === 1) ? '每小时用电量' : '日用电量';
        unit = 'kWh';
    }
    
    const option = {
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                const value = params[0].value;
                const displayValue = (identifier === 'socket' || identifier === 'auto_price_enable' || identifier === 'low_power_enable') 
                    ? formatEnumValue(value, identifier) 
                    : value.toFixed(2);
                return `${params[0].axisValue}<br/>${seriesName}: ${displayValue} ${unit}`;
            }
        },
        grid: { left: '8%', right: '8%', top: 20, bottom: 40, containLabel: true },
        xAxis: {
            type: 'category',
            data: times,
            axisLabel: { rotate: 45, fontSize: 12, interval: 0 }
        },
        yAxis: {
            type: identifier === 'socket' || identifier === 'auto_price_enable' || identifier === 'low_power_enable' ? 'category' : 'value',
            data: identifier === 'socket' || identifier === 'auto_price_enable' || identifier === 'low_power_enable' ? ['关', '开'] : [],
            name: unit,
            nameTextStyle: { fontSize: 12 },
            axisLabel: {
                formatter: function(value) {
                    if (identifier === 'socket' || identifier === 'auto_price_enable' || identifier === 'low_power_enable') {
                        return value == 1 ? '开' : '关';
                    }
                    return value;
                }
            }
        },
        series: [{
            name: seriesName,
            type: 'line',
            data: seriesData,
            smooth: identifier !== 'socket' && identifier !== 'auto_price_enable' && identifier !== 'low_power_enable',
            lineStyle: { color: '#3b82f6', width: 2 },
            symbol: 'circle',
            symbolSize: 6,
            showSymbol: true
        }]
    };

    historyChart.setOption(option);
}

// 加载历史数据
async function loadHistoryData(identifier, days = currentTimeRange) {
    historyLoading.style.display = 'block';
    historyLoading.innerText = '加载中...';
    if (historyChart) historyChart.clear();

    try {
        const { start, end } = getTimeRange(days);
        console.log(`查询${identifier}(${days}天)：`, new Date(start), '至', new Date(end));
        const rawData = await fetchHistoryData(identifier, start, end);
        
        let intervalMs;
        if (days === 1) {
            intervalMs = 60 * 60 * 1000;
        } else if (days === 7) {
            intervalMs = 24 * 60 * 60 * 1000;
        } else {
            intervalMs = 60 * 60 * 1000;
        }
        const aggregatedData = aggregateDataByTime(rawData, identifier, intervalMs);
        
        if (identifier === 'total_energy' && (days === 1 || days === 7)) {
            const diffData = computeDiffData(aggregatedData, days);
            updatePeakInfo(diffData, identifier);
            renderHistoryChart(diffData, identifier, days, true);
        } else {
            updatePeakInfo(aggregatedData, identifier);
            renderHistoryChart(aggregatedData, identifier, days, false);
        }
    } catch (error) {
        console.error('加载历史数据失败:', error);
        showError(`加载${identifier}历史数据失败: ${error.message}`);
    } finally {
        historyLoading.style.display = 'none';
    }
}

// 自定义时间查询
async function queryCustomTimeData() {
    const startStr = startTimeInput.value;
    const endStr = endTimeInput.value;
    if (!startStr || !endStr) {
        showError('请选择开始时间和结束时间');
        return;
    }
    const startTime = datetimeToTimestamp(startStr);
    const endTime = datetimeToTimestamp(endStr);
    if (startTime >= endTime) {
        showError('开始时间不能晚于或等于结束时间');
        return;
    }
    historyTimeBtns.forEach(btn => btn.classList.remove('active'));
    historyLoading.style.display = 'block';
    historyLoading.innerText = '加载中...';
    if (historyChart) historyChart.clear();

    try {
        console.log(`自定义时间查询：`, new Date(startTime), '至', new Date(endTime));
        const rawData = await fetchHistoryData(currentHistoryAttr, startTime, endTime);
        const durationMs = endTime - startTime;
        let intervalMs;
        if (durationMs <= 24 * 60 * 60 * 1000) {
            intervalMs = 60 * 60 * 1000;
        } else {
            intervalMs = 24 * 60 * 60 * 1000;
        }
        const aggregatedData = aggregateDataByTime(rawData, currentHistoryAttr, intervalMs);
        
        if (currentHistoryAttr === 'total_energy') {
            const diffData = computeDiffData(aggregatedData, durationMs <= 24*60*60*1000 ? 1 : 7);
            updatePeakInfo(diffData, currentHistoryAttr);
            renderHistoryChart(diffData, currentHistoryAttr, 0, true);
        } else {
            updatePeakInfo(aggregatedData, currentHistoryAttr);
            renderHistoryChart(aggregatedData, currentHistoryAttr, 0, false);
        }
    } catch (error) {
        console.error('加载自定义时间数据失败:', error);
        showError(`加载历史数据失败: ${error.message}`);
    } finally {
        historyLoading.style.display = 'none';
    }
}

// 按钮激活
function setActiveAttrBtn(btn) {
    historyAttrBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentHistoryAttr = btn.dataset.attr;
    const activeTimeBtn = document.querySelector('.history-time-btn.active');
    if (activeTimeBtn) {
        const days = parseInt(activeTimeBtn.dataset.days);
        loadHistoryData(currentHistoryAttr, days);
    } else {
        queryCustomTimeData();
    }
}

function setActiveTimeBtn(btn) {
    historyTimeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTimeRange = parseInt(btn.dataset.days);
    loadHistoryData(currentHistoryAttr, currentTimeRange);
}

function initHistoryModule() {
    historyAttrBtns.forEach(btn => {
        btn.addEventListener('click', () => setActiveAttrBtn(btn));
    });
    historyTimeBtns.forEach(btn => {
        btn.addEventListener('click', () => setActiveTimeBtn(btn));
    });
    loadHistoryData('voltage', 1);
    window.addEventListener('resize', () => {
        if (historyChart) historyChart.resize();
    });
}

// 初始化
window.onload = function() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    fetchDeviceData();
    setInterval(fetchDeviceData, 5 * 1000); // 改为5秒轮询
    syncVoltageMaxFromInput();
    syncCurrentMaxFromInput();
    syncPowerMaxFromInput();
    syncCurrentPriceFromInput();
    syncPriceThresholdFromInput();
    syncPowerLowThresholdFromInput();
    syncLowPowerDurationFromInput();
    initHistoryModule();
};
