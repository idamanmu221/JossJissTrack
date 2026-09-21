const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const useragent = require('express-useragent');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(useragent.express());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CONFIGURATION
const IMONETIZEIT_BASE_URL = 'https://kebkzw.dlstinguishedate.net/?utm_source=da57dc555e50572d&ban=fb&j1=1&s1=205200&s2=2060889';

// GANTI DENGAN CONNECTION STRING MONGODB ATLAS ANDA
const MONGODB_URI = 'mongodb+srv://idamanmu221_db_user:eWoay7EzZ4SYskzI@cluster0.oqtct5v.mongodb.net/?appName=Cluster0';

const PASSWORDS = {
    admin: 'admin123',
    guest: 'user123'
};

// CONNECT TO MONGODB ATLAS
mongoose.connect(MONGODB_URI)
    .then(() => console.log('[DB] Terhubung secara permanen ke MongoDB Atlas!'))
    .catch(err => console.error('[DB] Gagal terhubung ke MongoDB:', err.message));

// SCHEMA DATABASE
const ClickSchema = new mongoose.Schema({
    id: Number,
    isoDate: String,
    sub_id: String,
    ip: String,
    country: String,
    flag: String,
    deviceInfo: Object,
    visitorKey: String,
    type: { type: String, default: 'click' }
});

const ConversionSchema = new mongoose.Schema({
    id: Number,
    isoDate: String,
    sub_id: String,
    country: String,
    flag: String,
    deviceInfo: Object,
    amountVal: Number,
    amount: String
});

const ClickModel = mongoose.model('Click', ClickSchema);
const ConversionModel = mongoose.model('Conversion', ConversionSchema);

// KAMUS PEMETAAN NAMA NEGARA LENGKAP KE KODE ISO 2-LETTER
const COUNTRY_MAP = {
    'AFGHANISTAN': 'AF', 'ALBANIA': 'AL', 'ALGERIA': 'DZ', 'ARGENTINA': 'AR', 'ARMENIA': 'AM',
    'AUSTRALIA': 'AU', 'AUSTRIA': 'AT', 'AZERBAIJAN': 'AZ', 'BAHRAIN': 'BH', 'BANGLADESH': 'BD',
    'BELARUS': 'BY', 'BELGIUM': 'BE', 'BOLIVIA': 'BO', 'BOSNIA AND HERZEGOVINA': 'BA', 'BRAZIL': 'BR',
    'BULGARIA': 'BG', 'CAMBODIA': 'KH', 'CANADA': 'CA', 'CHILE': 'CL', 'CHINA': 'CN', 'COLOMBIA': 'CO',
    'COSTA RICA': 'CR', 'CROATIA': 'HR', 'CYPRUS': 'CY', 'CZECH REPUBLIC': 'CZ', 'CZECHIA': 'CZ',
    'DENMARK': 'DK', 'DOMINICAN REPUBLIC': 'DO', 'ECUADOR': 'EC', 'EGYPT': 'EG', 'EL SALVADOR': 'SV',
    'ESTONIA': 'EE', 'FINLAND': 'FI', 'FRANCE': 'FR', 'GEORGIA': 'GE', 'GERMANY': 'DE', 'GREECE': 'GR',
    'GUATEMALA': 'GT', 'HONDURAS': 'HN', 'HONG KONG': 'HK', 'HUNGARY': 'HU', 'ICELAND': 'IS',
    'INDIA': 'IN', 'INDONESIA': 'ID', 'IRAQ': 'IQ', 'IRELAND': 'IE', 'ISRAEL': 'IL', 'ITALY': 'IT',
    'JAMAICA': 'JM', 'JAPAN': 'JP', 'JORDAN': 'JO', 'KAZAKHSTAN': 'KZ', 'KENYA': 'KE', 'KOREA': 'KR',
    'SOUTH KOREA': 'KR', 'KUWAIT': 'KW', 'LATVIA': 'LV', 'LEBANON': 'LB', 'LITHUANIA': 'LT',
    'LUXEMBOURG': 'LU', 'MALAYSIA': 'MY', 'MEXICO': 'MX', 'MOLDOVA': 'MD', 'MONTENEGRO': 'ME',
    'MOROCCO': 'MA', 'NETHERLANDS': 'NL', 'NEW ZEALAND': 'NZ', 'NICARAGUA': 'NI', 'NIGERIA': 'NG',
    'NORTH MACEDONIA': 'MK', 'NORWAY': 'NO', 'OMAN': 'OM', 'PAKISTAN': 'PK', 'PANAMA': 'PA',
    'PARAGUAY': 'PY', 'PERU': 'PE', 'PHILIPPINES': 'PH', 'POLAND': 'PL', 'PORTUGAL': 'PT',
    'QATAR': 'QA', 'ROMANIA': 'RO', 'RUSSIA': 'RU', 'SAUDI ARABIA': 'SA', 'SERBIA': 'RS',
    'SINGAPORE': 'SG', 'SLOVAKIA': 'SK', 'SLOVENIA': 'SI', 'SOUTH AFRICA': 'ZA', 'SPAIN': 'ES',
    'SRI LANKA': 'LK', 'SWEDEN': 'SE', 'SWITZERLAND': 'CH', 'TAIWAN': 'TW', 'THAILAND': 'TH',
    'TUNISIA': 'TN', 'TURKEY': 'TR', 'TÜRKIYE': 'TR', 'UKRAINE': 'UA', 'UNITED ARAB EMIRATES': 'AE',
    'UNITED KINGDOM': 'GB', 'UNITED STATES': 'US', 'URUGUAY': 'UY', 'UZBEKISTAN': 'UZ',
    'VENEZUELA': 'VE', 'VIETNAM': 'VN'
};

function toTitleCase(str) {
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode === 'XX' || countryCode === 'LOCAL') {
        return '<i class="fa-solid fa-globe" style="font-size:14px;"></i>';
    }
    const code = countryCode.toLowerCase();
    return `<img src="https://flagcdn.com/24x18/${code}.png" class="flag-img" alt="${countryCode}">`;
}
function getDeviceIcons(uaOrReq) {
    let rawUa = '';
    if (uaOrReq && uaOrReq.headers && uaOrReq.headers['user-agent']) {
        rawUa = uaOrReq.headers['user-agent'];
    } else if (uaOrReq && uaOrReq.source) {
        rawUa = uaOrReq.source;
    } else if (typeof uaOrReq === 'string') {
        rawUa = uaOrReq;
    }

    const uaLower = rawUa.toLowerCase();

    let osIcon = 'fa-desktop';
    let osName = 'Desktop';

    if (uaLower.includes('android')) {
        osIcon = 'fa-android';
        osName = 'Android';
    } else if (uaLower.includes('iphone') || uaLower.includes('ipad') || uaLower.includes('ipod') || uaLower.includes('macintosh') || uaLower.includes('mac os')) {
        osIcon = 'fa-apple';
        osName = 'iOS / Mac';
    } else if (uaLower.includes('windows')) {
        osIcon = 'fa-windows';
        osName = 'Windows';
    } else if (uaLower.includes('linux') || uaLower.includes('cros')) {
        osIcon = 'fa-linux';
        osName = 'Linux';
    }

    let browserIcon = 'fa-globe';
    let browserName = 'Browser';

    if (uaLower.includes('edg/') || uaLower.includes('edge')) {
        browserIcon = 'fa-edge';
        browserName = 'Edge';
    } else if (uaLower.includes('opr/') || uaLower.includes('opera')) {
        browserIcon = 'fa-opera';
        browserName = 'Opera';
    } else if (uaLower.includes('samsungbrowser')) {
        browserIcon = 'fa-globe';
        browserName = 'Samsung Internet';
    } else if (uaLower.includes('firefox') || uaLower.includes('fxios')) {
        browserIcon = 'fa-firefox-browser';
        browserName = 'Firefox';
    } else if (uaLower.includes('chrome') || uaLower.includes('crios')) {
        browserIcon = 'fa-chrome';
        browserName = 'Chrome';
    } else if (uaLower.includes('safari') && !uaLower.includes('chrome')) {
        browserIcon = 'fa-safari';
        browserName = 'Safari';
    } else if (uaLower.includes('trident') || uaLower.includes('msie')) {
        browserIcon = 'fa-internet-explorer';
        browserName = 'IE';
    }

    return {
        browserName: browserName,
        osName: osName,
        browserIcon: browserIcon,
        osIcon: osIcon
    };
}

function getOsIconFromPostback(osStr) {
    if (!osStr) return { osName: 'Unknown', osIcon: 'fa-desktop' };
    const cleanOs = osStr.trim().toLowerCase();

    let icon = 'fa-desktop';
    if (cleanOs.includes('android')) icon = 'fa-android';
    else if (cleanOs.includes('ios') || cleanOs.includes('mac') || cleanOs.includes('iphone') || cleanOs.includes('ipad')) icon = 'fa-apple';
    else if (cleanOs.includes('windows')) icon = 'fa-windows';
    else if (cleanOs.includes('linux')) icon = 'fa-linux';

    return {
        osName: toTitleCase(osStr),
        osIcon: icon
    };
}

async function getGeoLocation(ip) {
    if (ip && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
    }
    if (ip && ip.startsWith('::ffff:')) {
        ip = ip.replace('::ffff:', '');
    }

    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
        return { country: 'Indonesia (Local)', countryCode: 'ID', flag: '🇮🇩', ip: '127.0.0.1' };
    }

    try {
        const res = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 3000 });
        if (res.data && res.data.country_code && res.data.country_code !== 'UNDEFINED') {
            const countryCode = res.data.country_code;
            const countryName = res.data.country_name || 'Unknown';
            const flag = getFlagEmoji(countryCode);
            return { country: countryName, countryCode: countryCode, flag: flag, ip: ip };
        }
    } catch (err) {
        try {
            const fallbackRes = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 3000 });
            if (fallbackRes.data && fallbackRes.data.status === 'success') {
                const flag = getFlagEmoji(fallbackRes.data.countryCode);
                return { country: fallbackRes.data.country, countryCode: fallbackRes.data.countryCode, flag: flag, ip: ip };
            }
        } catch (e) {}
    }

    return { country: 'Unknown', countryCode: 'XX', flag: '🌐', ip: ip };
}

// Endpoint Tracking & Redirection Klik
app.get('/click', async (req, res) => {
    const subId = req.query.sub_id || 'sub1';

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const geo = await getGeoLocation(clientIp);
    const deviceInfo = getDeviceIcons(req);
    const now = new Date();

    const userAgentSource = req.headers['user-agent'] || (req.useragent ? req.useragent.source : '');

    const clickObj = {
        id: Date.now() + Math.random(),
        isoDate: now.toISOString(),
        sub_id: subId,
        ip: geo.ip,
        country: geo.country,
        flag: geo.flag,
        deviceInfo: deviceInfo,
        visitorKey: `${geo.ip}_${userAgentSource}`,
        type: 'click'
    };

    await ClickModel.create(clickObj);
    io.emit('new-click', clickObj);

    const encodedSubId = encodeURIComponent(subId);
    const destinationUrl = `${IMONETIZEIT_BASE_URL}&s3=${encodedSubId}&s5=${encodedSubId}&click_id=${encodedSubId}`;

    res.redirect(destinationUrl);
});

// Endpoint Verifikasi Login
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORDS.admin) {
        return res.json({ status: 'ok', role: 'admin' });
    } else if (password === PASSWORDS.guest) {
        return res.json({ status: 'ok', role: 'guest' });
    } else {
        return res.status(401).json({ status: 'error', message: 'Password salah!' });
    }
});

app.post('/api/force-logout', (req, res) => {
    io.emit('force-logout-all');
    res.json({ status: 'ok', message: 'Semua sesi berhasil dikeluarkan.' });
});

app.get('/api/initial-data', async (req, res) => {
    try {
        const clicksHistory = await ClickModel.find().sort({ _id: -1 }).limit(5000);
        const conversionsHistory = await ConversionModel.find().sort({ _id: -1 }).limit(5000);
        res.json({ clicksHistory, conversionsHistory });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil data' });
    }
});

app.post('/api/track-click', async (req, res) => {
    const subId = req.body.sub_id || req.query.sub_id || 'sub1';
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const geo = await getGeoLocation(clientIp);
    const deviceInfo = getDeviceIcons(req);
    const now = new Date();

    const userAgentSource = req.headers['user-agent'] || (req.useragent ? req.useragent.source : '');

    const clickObj = {
        id: Date.now() + Math.random(),
        isoDate: now.toISOString(),
        sub_id: subId,
        ip: geo.ip,
        country: geo.country,
        flag: geo.flag,
        deviceInfo: deviceInfo,
        visitorKey: `${geo.ip}_${userAgentSource}`,
        type: 'click'
    };

    await ClickModel.create(clickObj);
    io.emit('new-click', clickObj);
    res.json({ status: 'ok' });
});

// FUNGSI PROSES KONVERSI POSTBACK
async function processConversion(req, res) {
    const subId = req.query.sub_id || req.body.sub_id || 
                  req.query.click_id || req.body.click_id || 
                  req.query.token_1 || req.body.token_1 || 
                  req.query.s3 || req.body.s3 || 'sub1';

    let amountVal = parseFloat(req.query.amount || req.body.amount || req.query.payout || req.body.payout);
    if (isNaN(amountVal)) {
        amountVal = 1.00;
    }

    const rawCountry = req.query.country || req.body.country;
    let countryName = 'Unknown';
    let flagEmoji = '🌐';

    if (rawCountry && rawCountry.trim() !== '' && rawCountry !== '{country}') {
        const cleanedCountry = rawCountry.trim().toUpperCase();
        
        if (cleanedCountry.length === 2) {
            flagEmoji = getFlagEmoji(cleanedCountry);
            countryName = cleanedCountry;
        } else if (COUNTRY_MAP[cleanedCountry]) {
            const isoCode = COUNTRY_MAP[cleanedCountry];
            flagEmoji = getFlagEmoji(isoCode);
            countryName = toTitleCase(rawCountry.trim());
        } else {
            countryName = toTitleCase(rawCountry.trim());
            flagEmoji = '🌐';
        }
    }

    const rawOs = req.query.os || req.body.os;
    let devInfo = { osName: 'Desktop', osIcon: 'fa-desktop' };

    if (rawOs && rawOs.trim() !== '' && rawOs !== '{os}') {
        devInfo = getOsIconFromPostback(rawOs);
    } else {
        const matchedClick = await ClickModel.findOne({ sub_id: subId, type: 'click' }).sort({ _id: -1 });
        if (matchedClick && matchedClick.deviceInfo) {
            devInfo = matchedClick.deviceInfo;
        }
    }

    const now = new Date();

    const convObj = {
        id: Date.now() + Math.random(),
        isoDate: now.toISOString(),
        sub_id: subId,
        country: countryName,
        flag: flagEmoji,
        deviceInfo: devInfo,
        amountVal: amountVal,
        amount: '$' + amountVal.toFixed(2)
    };

    await ConversionModel.create(convObj);
    io.emit('new-conversion', convObj);
    console.log(`[CONVERSION SUCCESS] SubID: ${subId} | Amount: $${amountVal} | Country: ${countryName} | OS: ${devInfo.osName}`);

    return res.json({ status: 'ok', sub_id: subId, amount: amountVal, country: countryName });
}

app.post('/api/track-conversion', async (req, res) => {
    await processConversion(req, res);
});

app.get('/api/track-conversion', async (req, res) => {
    await processConversion(req, res);
});

// ENDPOINT HAPUS DATA KONVERSI BERDASARKAN SUB_ID
app.get('/api/delete-conversion', async (req, res) => {
    const targetSubId = req.query.sub_id;
    if (!targetSubId) {
        return res.status(400).json({ status: 'error', message: 'Masukkan parameter sub_id yang ingin dihapus' });
    }

    try {
        await ConversionModel.deleteMany({ sub_id: targetSubId });
        res.json({ status: 'ok', message: `Data konversi dengan sub_id '${targetSubId}' berhasil dihapus.` });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ENDPOINT RESET/HAPUS SELURUH DATA STATISTIK
app.get('/api/clear-all-data', async (req, res) => {
    try {
        await ClickModel.deleteMany({});
        await ConversionModel.deleteMany({});
        res.json({ status: 'ok', message: 'Seluruh data klik dan konversi berhasil dibersihkan.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Serve Dashboard UI
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>JossJiss - Analytics Dashboard</title>
    <script src="/socket.io/socket.io.js"></script>
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>

    <style>
        :root {
            --bg-color: #f4f6f9;
            --text-color: #333333;
            --panel-bg: #ffffff;
            --header-bg: #1e293b;
            --border-color: #e2e8f0;
            --table-header: #f8fafc;
            --badge-bg: #e0f2fe;
            --badge-text: #0369a1;
            --sub-panel-bg: #f1f5f9;
            --row-expand-bg: #f8fafc;
        }

        [data-theme="dark"] {
            --bg-color: #0f172a;
            --text-color: #f8fafc;
            --panel-bg: #1e293b;
            --header-bg: #020617;
            --border-color: #334155;
            --table-header: #0f172a;
            --badge-bg: #1e3a8a;
            --badge-text: #93c5fd;
            --sub-panel-bg: #1e293b;
            --row-expand-bg: #0f172a;
        }

        * { 
            box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            transition: background-color 0.2s, color 0.2s;
            -webkit-user-select: none; user-select: none;
        }

        input, select, button {
            -webkit-user-select: text; user-select: text;
        }

        body { background: var(--bg-color); color: var(--text-color); overflow-x: hidden; }

        #loginOverlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #0f172a; z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 15px;
        }
        .login-card {
            background: #1e293b; padding: 30px 20px; border-radius: 12px; width: 100%; max-width: 340px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; color: white;
        }
        .login-title {
            font-size: 28px; font-weight: 800; color: #38bdf8; letter-spacing: 1.5px;
            margin-bottom: 5px; text-transform: uppercase;
        }
        .login-subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 20px; }
        .login-card input {
            width: 100%; padding: 12px; border-radius: 6px; border: 1px solid #334155;
            background: #0f172a; color: white; margin-bottom: 15px; outline: none; text-align: center; font-size: 16px;
        }
        .login-card button {
            width: 100%; padding: 12px; border-radius: 6px; border: none;
            background: #3b82f6; color: white; font-weight: bold; cursor: pointer; font-size: 15px;
        }

        header { 
            background: var(--header-bg); color: white; padding: 12px 15px; 
            display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
            position: sticky; top: 0; z-index: 1000;
        }
        .header-left { display: flex; align-items: center; gap: 10px; }
        .header-title-mob { font-size: 18px; font-weight: 800; color: #38bdf8; letter-spacing: 1px; text-transform: uppercase; }

        .header-right { display: flex; align-items: center; gap: 8px; }

        .clock-container {
            display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.2);
            border: 1px solid #334155; padding: 4px 8px; border-radius: 6px; font-size: 12px;
        }
        .timezone-select {
            background: #1e293b; color: #38bdf8; border: 1px solid #475569;
            padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: bold; outline: none;
        }
        .utc-clock-box { font-size: 12px; color: #38bdf8; font-weight: bold; font-family: monospace; }

        .btn-theme, .btn-logout {
            background: #334155; color: white; border: none; padding: 8px 10px;
            border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;
        }

        .btn-menu {
            background: #3b82f6; color: white; border: none; padding: 8px 12px;
            font-size: 14px; font-weight: bold; border-radius: 6px; cursor: pointer;
        }

        .menu-dropdown {
            display: none; position: fixed; top: 55px; left: 10px; right: 10px; max-width: 360px;
            background: #0f172a; border-radius: 8px; padding: 15px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 9999; color: white; border: 1px solid #334155;
        }
        .menu-dropdown.show { display: block !important; }
        .menu-dropdown button.menu-item { 
            display: block; width: 100%; text-align: left; background: none; border: none;
            color: #cbd5e1; padding: 10px 0; font-size: 14px; cursor: pointer;
            border-bottom: 1px solid #334155; 
        }

        .test-box { margin-top: 10px; background: #1e293b; padding: 10px; border-radius: 6px; border: 1px solid #334155; }
        .test-box input, .test-box select, .test-box button { width: 100%; margin-top: 6px; padding: 8px; border-radius: 4px; border: none; font-size: 13px; }
        .test-box input { background: #0f172a; color: white; border: 1px solid #334155; }
        .test-box button { background: #10b981; color: white; cursor: pointer; font-weight: bold; }
        .btn-force-logout { background: #ef4444 !important; margin-top: 10px !important; }

        #main { padding: 10px; }
        .panel { background: var(--panel-bg); padding: 12px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-top: 10px; }
        
        .filter-bar {
            display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
            background: var(--sub-panel-bg); padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 13px;
        }
        .filter-bar input[type="text"] {
            padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 5px; font-size: 13px; outline: none;
            background: var(--panel-bg); color: var(--text-color); flex: 1; min-width: 120px;
        }
        .btn-preset {
            padding: 6px 10px; background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 5px;
            cursor: pointer; font-size: 12px; font-weight: bold; color: var(--text-color); flex: 1; text-align: center;
        }
        .btn-preset.active {
            background: #3b82f6 !important; color: white !important; border-color: #3b82f6 !important;
        }

        .summary-grid {
            display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px;
        }
        @media (min-width: 600px) {
            .summary-grid { grid-template-columns: repeat(4, 1fr); }
        }
        .stat-card {
            background: var(--sub-panel-bg); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); text-align: center;
        }
        .stat-card .label { font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; }
        .stat-card .value { font-size: 16px; font-weight: 800; margin-top: 4px; }

        .table-responsive {
            width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 5px;
        }
        
        table { width: 100%; border-collapse: collapse; text-align: left; min-width: 500px; }
        th, td { padding: 10px 8px; border-bottom: 1px solid var(--border-color); font-size: 13px; white-space: nowrap; }
        th { background: var(--table-header); }
        
        tr.clickable-row { cursor: pointer; transition: background 0.15s; }
        tr.clickable-row:hover { background: var(--sub-panel-bg); }

        .badge-subid { background: var(--badge-bg); color: var(--badge-text); padding: 3px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; }
        .flag-icon { font-size: 16px; margin-right: 4px; vertical-align: middle; }
        
        .device-badge {
            display: inline-flex; align-items: center; gap: 4px;
            background: var(--sub-panel-bg); padding: 3px 6px; border-radius: 4px; font-size: 11px; color: var(--text-color);
        }

        .country-detail-container {
            background: var(--row-expand-bg); padding: 10px 15px; border-radius: 6px; margin: 4px 0; border: 1px solid var(--border-color);
        }
        .country-detail-table {
            width: 100%; margin-top: 5px; font-size: 12px;
        }
        .country-detail-table th {
            background: var(--sub-panel-bg); font-size: 11px; color: #64748b; padding: 6px 8px;
        }
        .country-detail-table td {
            padding: 6px 8px; border-bottom: 1px dashed var(--border-color);
        }
        
        .flag-img {
            width: 18px;
            height: 13px;
            object-fit: cover;
            border-radius: 2px;
            vertical-align: middle;
            margin-right: 5px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        
        .hidden { display: none !important; }
    </style>
</head>
<body>

    <div id="loginOverlay">
        <div class="login-card">
            <div class="login-title">JossJiss</div>
            <div class="login-subtitle">Realtime Analytics System</div>
            <input type="password" id="passInput" placeholder="Masukkan Password..." onkeyup="if(event.key==='Enter') attemptLogin()">
            <button onclick="attemptLogin()">LOGIN</button>
            <div id="loginError" style="color:#ef4444; font-size:12px; margin-top:10px; display:none;">Password Salah!</div>
        </div>
    </div>

    <header>
        <div class="header-left">
            <button class="btn-menu" id="toggleBtn">☰ Menu</button>
            <span class="header-title-mob">JossJiss</span>
        </div>

        <div class="header-right">
            <div class="clock-container">
                <select id="tzSelect" class="timezone-select" onchange="onTimezoneChange()">
                    <option value="0" selected>UTC+0</option>
                    <option value="7">WIB</option>
                </select>
                <div class="utc-clock-box">
                    <span id="liveClock">00:00:00</span>
                </div>
            </div>

            <button class="btn-theme" onclick="toggleTheme()"><i id="themeIcon" class="fa-solid fa-moon"></i></button>
            <button class="btn-logout" onclick="logoutCurrentSession()"><i class="fa-solid fa-right-from-bracket"></i></button>
        </div>
    </header>

    <div id="navMenu" class="menu-dropdown">
        <h4 style="margin-bottom:8px; color:#94a3b8; font-size:12px;">NAVIGASI VIEWS</h4>
        <button class="menu-item" onclick="switchView('subid')">📊 Total Performance Sub ID</button>
        <button class="menu-item" onclick="switchView('conversion')">🛒 Live Conversion</button>
        <button class="menu-item" onclick="switchView('click')">⚡ Live Klik (Max 100)</button>

        <div id="adminPanel" class="test-box hidden">
            <p style="font-size:11px; font-weight:bold; color:#38bdf8;">🔗 SMARTLINK GENERATOR:</p>
            <input type="text" id="genSubId" placeholder="Sub ID (misal: fb_ads)...">
            <button onclick="generateLink()" style="background:#3b82f6;">Buat Link Tracking</button>
            
            <div id="genResultBox" style="display:none; margin-top:8px;">
                <input type="text" id="generatedUrl" readonly onclick="this.select()" style="font-size:11px; color:#10b981;">
                <button onclick="copyGeneratedLink()" style="background:#059669; margin-top:4px;">📋 Salin Link</button>
            </div>

            <hr style="border:0; border-top:1px solid #334155; margin:10px 0;">

            <p style="font-size:11px; font-weight:bold; color:#10b981;">⚡ SIMULATOR:</p>
            <select id="sim-subid">
                <option value="sub1">Sub ID: sub1</option>
                <option value="sub2">Sub ID: sub2</option>
                <option value="campaign_fb">Sub ID: campaign_fb</option>
            </select>
            <button onclick="triggerClick()">Simulasi Klik</button>
            <button onclick="triggerConv()">Simulasi Konversi</button>
            
            <button class="btn-force-logout" onclick="triggerForceLogout()">🔒 Force Logout All</button>
        </div>
    </div>

    <div id="main">

        <div id="dateFilterBar" class="filter-bar">
            <input type="text" id="startDatePicker" placeholder="Dari Tanggal (UTC)">
            <input type="text" id="endDatePicker" placeholder="Sampai Tanggal (UTC)">
            <button id="btn-today" class="btn-preset active" onclick="setPreset('today')">Hari Ini (UTC)</button>
            <button id="btn-yesterday" class="btn-preset" onclick="setPreset('yesterday')">Kemarin (UTC)</button>
            <button id="btn-week" class="btn-preset" onclick="setPreset('week')">Minggu Ini (UTC)</button>
            <button id="btn-month" class="btn-preset" onclick="setPreset('month')">Bulan Ini (UTC)</button>
            <button class="btn-preset" onclick="resetDateFilter()">Reset (Semua)</button>
        </div>

        <div class="summary-grid">
            <div class="stat-card">
                <div class="label">Total Clicks</div>
                <div class="value" id="card-clicks">0</div>
            </div>
            <div class="stat-card">
                <div class="label">Uniques</div>
                <div class="value" id="card-uniques" style="color:#8b5cf6;">0</div>
            </div>
            <div class="stat-card">
                <div class="label">Conversions</div>
                <div class="value" id="card-conversions" style="color:#3b82f6;">0</div>
            </div>
            <div class="stat-card">
                <div class="label">Revenue</div>
                <div class="value" id="card-revenue" style="color:#10b981;">$0.00</div>
            </div>
        </div>
        
        <section id="subid-sec" class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px;">
                <h3 style="font-size:15px;">📊 Performance per Sub ID <span style="font-size:11px; color:#64748b; font-weight:normal;">(Klik baris untuk detail negara)</span></h3>
                <input type="text" id="searchSubId" placeholder="🔍 Cari..." onkeyup="renderAnalytics()" style="padding: 6px 8px; width: 110px; border: 1px solid var(--border-color); border-radius: 5px; font-size:12px;">
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Sub ID</th>
                            <th>Clicks</th>
                            <th>Uniques</th>
                            <th>Conversions</th>
                            <th>CR (%)</th>
                            <th>Revenue ($)</th>
                        </tr>
                    </thead>
                    <tbody id="tbl-subid-body"></tbody>
                </table>
            </div>
        </section>

        <section id="conv-sec" class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px;">
                <h3 style="font-size:15px;">🛒 Live Conversion</h3>
                <input type="text" id="searchConv" placeholder="🔍 Cari..." onkeyup="renderAnalytics()" style="padding: 6px 8px; width: 110px; border: 1px solid var(--border-color); border-radius: 5px; font-size:12px;">
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr><th class="th-time">Waktu</th><th>Sub ID</th><th>Negara</th><th>Perangkat</th><th>Value ($)</th></tr>
                    </thead>
                    <tbody id="tbl-conv"></tbody>
                </table>
            </div>
        </section>

        <section id="click-sec" class="panel hidden">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px;">
                <h3 style="font-size:15px;">⚡ Live Klik <span style="font-size:11px; color:#64748b; font-weight:normal;">(Menampilkan 100 Klik Terakhir)</span></h3>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr><th class="th-time">Waktu</th><th>Sub ID</th><th>IP</th><th>Negara</th><th>Perangkat</th></tr>
                    </thead>
                    <tbody id="tbl-click"></tbody>
                </table>
            </div>
        </section>

    </div>

    <script>
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', e => {
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key.toUpperCase())) || (e.ctrlKey && e.key.toUpperCase() === 'U')) {
                e.preventDefault();
            }
        });

        let userRole = localStorage.getItem('user_role') || null;
        let expandedSubIds = new Set();

        function checkSession() {
            if (userRole === 'admin' || userRole === 'guest') {
                document.getElementById('loginOverlay').style.display = 'none';
                if (userRole === 'admin') {
                    document.getElementById('adminPanel').classList.remove('hidden');
                } else {
                    document.getElementById('adminPanel').classList.add('hidden');
                }
            } else {
                document.getElementById('loginOverlay').style.display = 'flex';
            }
        }

        async function attemptLogin() {
            const pass = document.getElementById('passInput').value;
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pass })
            });

            if (res.ok) {
                const data = await res.json();
                userRole = data.role;
                localStorage.setItem('user_role', userRole);
                document.getElementById('loginError').style.display = 'none';
                document.getElementById('passInput').value = '';
                checkSession();
                fetchInitialData();
            } else {
                document.getElementById('loginError').style.display = 'block';
            }
        }

        function logoutCurrentSession() {
            localStorage.removeItem('user_role');
            userRole = null;
            checkSession();
        }

        async function fetchInitialData() {
            try {
                const res = await fetch('/api/initial-data');
                if (res.ok) {
                    const data = await res.json();
                    allClicks = data.clicksHistory || [];
                    allConversions = data.conversionsHistory || [];
                    
                    setPreset('today');
                }
            } catch (err) {}
        }

        function generateLink() {
            const inputVal = document.getElementById('genSubId').value.trim();
            const subId = inputVal !== '' ? inputVal : 'sub1';
            const baseUrl = window.location.origin;
            const finalUrl = \`\${baseUrl}/click?sub_id=\${encodeURIComponent(subId)}\`;

            document.getElementById('generatedUrl').value = finalUrl;
            document.getElementById('genResultBox').style.display = 'block';
        }

        function copyGeneratedLink() {
            const copyText = document.getElementById('generatedUrl');
            copyText.select();
            navigator.clipboard.writeText(copyText.value);
            alert("📋 Link berhasil disalin!");
        }

        function initTheme() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
            updateThemeIcon(savedTheme);
        }

        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        }

        function updateThemeIcon(theme) {
            document.getElementById('themeIcon').className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }

        let selectedTimezoneOffset = 0;

        function onTimezoneChange() {
            selectedTimezoneOffset = parseInt(document.getElementById('tzSelect').value);
            const label = selectedTimezoneOffset === 7 ? 'Waktu (WIB)' : 'Waktu (UTC)';
            document.querySelectorAll('.th-time').forEach(el => el.innerText = label);
            updateClock();
            renderAnalytics();
        }

        function formatDateTimeByOffset(isoDateStr, offsetHours) {
            const date = new Date(isoDateStr);
            const targetTime = new Date(date.getTime() + (offsetHours * 60 * 60 * 1000));

            const year = targetTime.getUTCFullYear();
            const month = String(targetTime.getUTCMonth() + 1).padStart(2, '0');
            const day = String(targetTime.getUTCDate()).padStart(2, '0');
            const hours = String(targetTime.getUTCHours()).padStart(2, '0');
            const minutes = String(targetTime.getUTCMinutes()).padStart(2, '0');
            const seconds = String(targetTime.getUTCSeconds()).padStart(2, '0');

            return \`\${year}-\${month}-\${day} \${hours}:\${minutes}:\${seconds}\`;
        }

        function updateClock() {
            const nowIso = new Date().toISOString();
            document.getElementById('liveClock').innerText = formatDateTimeByOffset(nowIso, selectedTimezoneOffset).split(' ')[1];
        }

        setInterval(updateClock, 1000);

        let allClicks = [];
        let allConversions = [];

        let filterStartDate = null;
        let filterEndDate = null;

        const fpStart = flatpickr("#startDatePicker", {
            dateFormat: "Y-m-d",
            onChange: function(selectedDates) {
                filterStartDate = selectedDates[0] ? selectedDates[0] : null;
                clearActiveButtons();
                renderAnalytics();
            }
        });

        const fpEnd = flatpickr("#endDatePicker", {
            dateFormat: "Y-m-d",
            onChange: function(selectedDates) {
                if (selectedDates[0]) {
                    filterEndDate = new Date(selectedDates[0]);
                    filterEndDate.setHours(23, 59, 59, 999);
                } else {
                    filterEndDate = null;
                }
                clearActiveButtons();
                renderAnalytics();
            }
        });

        function clearActiveButtons() {
            document.getElementById('btn-today').classList.remove('active');
            document.getElementById('btn-yesterday').classList.remove('active');
            document.getElementById('btn-week').classList.remove('active');
            document.getElementById('btn-month').classList.remove('active');
        }

        function setPreset(preset) {
            clearActiveButtons();
            const now = new Date();
            let start = new Date();
            let end = new Date();
            
            if (preset === 'today') {
                document.getElementById('btn-today').classList.add('active');
                start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
                end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
            } else if (preset === 'yesterday') {
                document.getElementById('btn-yesterday').classList.add('active');
                start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
                end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999));
            } else if (preset === 'week') {
                document.getElementById('btn-week').classList.add('active');
                const day = now.getUTCDay() || 7;
                start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1, 0, 0, 0, 0));
                end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
            } else if (preset === 'month') {
                document.getElementById('btn-month').classList.add('active');
                start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
                end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
            }

            fpStart.setDate(start);
            fpEnd.setDate(end);

            filterStartDate = start;
            filterEndDate = end;

            renderAnalytics();
        }

        function resetDateFilter() {
            clearActiveButtons();
            fpStart.clear();
            fpEnd.clear();
            filterStartDate = null;
            filterEndDate = null;
            renderAnalytics();
        }

        const btn = document.getElementById('toggleBtn');
        const menu = document.getElementById('navMenu');

        btn.onclick = function(e) {
            e.stopPropagation();
            menu.classList.toggle('show');
        };

        document.onclick = function(e) {
            if (!menu.contains(e.target) && e.target !== btn) {
                menu.classList.remove('show');
            }
        };

        function switchView(viewType) {
            document.getElementById('subid-sec').classList.add('hidden');
            document.getElementById('conv-sec').classList.add('hidden');
            document.getElementById('click-sec').classList.add('hidden');

            const filterBar = document.getElementById('dateFilterBar');

            if (viewType === 'subid') {
                document.getElementById('subid-sec').classList.remove('hidden');
                filterBar.classList.remove('hidden');
            } else if (viewType === 'click') {
                document.getElementById('click-sec').classList.remove('hidden');
                filterBar.classList.add('hidden');
            } else {
                document.getElementById('conv-sec').classList.remove('hidden');
                filterBar.classList.remove('hidden');
            }

            menu.classList.remove('show');
        }

        function toggleSubIdExpand(subId) {
            if (expandedSubIds.has(subId)) {
                expandedSubIds.delete(subId);
            } else {
                expandedSubIds.add(subId);
            }
            renderAnalytics();
        }

        const socket = io();

        socket.on('force-logout-all', () => {
            alert('🔒 Akses Anda telah dikeluarkan!');
            logoutCurrentSession();
        });

        socket.on('new-click', data => {
            allClicks.unshift(data);
            renderAnalytics();
        });

        socket.on('new-conversion', data => {
            allConversions.unshift(data);
            renderAnalytics();
        });

        function renderAnalytics() {
            const subIdSearch = document.getElementById('searchSubId').value.toLowerCase();
            const convSearch = document.getElementById('searchConv').value.toLowerCase();

            const filteredClicks = allClicks.filter(c => {
                const dt = new Date(c.isoDate);
                if (filterStartDate && dt < filterStartDate) return false;
                if (filterEndDate && dt > filterEndDate) return false;
                return true;
            });

            const filteredConversions = allConversions.filter(c => {
                const dt = new Date(c.isoDate);
                if (filterStartDate && dt < filterStartDate) return false;
                if (filterEndDate && dt > filterEndDate) return false;
                return true;
            });

            const subIdStats = {};
            const globalUniques = new Set();
            let totalClicks = 0, totalConversions = 0, totalRevenue = 0;

            filteredClicks.forEach(c => {
                const sId = c.sub_id;
                const country = c.country || 'Unknown';
                const flag = c.flag || '🌐';

                if (!subIdStats[sId]) {
                    subIdStats[sId] = { clicks: 0, conversions: 0, revenue: 0, uniques: new Set(), countries: {} };
                }

                if (!subIdStats[sId].countries[country]) {
                    subIdStats[sId].countries[country] = { flag: flag, clicks: 0, conversions: 0, revenue: 0, uniques: new Set() };
                }

                totalClicks++;
                globalUniques.add(c.visitorKey);

                subIdStats[sId].clicks++;
                subIdStats[sId].uniques.add(c.visitorKey);

                subIdStats[sId].countries[country].clicks++;
                subIdStats[sId].countries[country].uniques.add(c.visitorKey);
            });

            filteredConversions.forEach(c => {
                const sId = c.sub_id;
                const country = c.country || 'Unknown';
                const flag = c.flag || '🌐';

                totalConversions++;
                totalRevenue += c.amountVal;

                if (!subIdStats[sId]) {
                    subIdStats[sId] = { clicks: 0, conversions: 0, revenue: 0, uniques: new Set(), countries: {} };
                }

                if (!subIdStats[sId].countries[country]) {
                    subIdStats[sId].countries[country] = { flag: flag, clicks: 0, conversions: 0, revenue: 0, uniques: new Set() };
                }

                subIdStats[sId].conversions++;
                subIdStats[sId].revenue += c.amountVal;

                subIdStats[sId].countries[country].conversions++;
                subIdStats[sId].countries[country].revenue += c.amountVal;
            });

            // SUB ID DENGAN REVENUE HIGHEST (PEMENANG MAHKOTA)
            let topSubId = null;
            let maxRevenue = 0;
            Object.keys(subIdStats).forEach(sId => {
                if (subIdStats[sId].revenue > maxRevenue && subIdStats[sId].revenue > 0) {
                    maxRevenue = subIdStats[sId].revenue;
                    topSubId = sId;
                }
            });

            // UPDATE CARDS STATISTIK
            document.getElementById('card-clicks').innerText = totalClicks;
            document.getElementById('card-uniques').innerText = globalUniques.size;
            document.getElementById('card-conversions').innerText = totalConversions;
            document.getElementById('card-revenue').innerText = '$' + totalRevenue.toFixed(2);

            // RENDER TAB CONVERSION (ADA MAHKOTA DI SUB ID PEMENANG REVENUE TERBESAR)
            const tbodyConv = document.getElementById('tbl-conv');
            tbodyConv.innerHTML = '';
            
            const searchedConversions = filteredConversions.filter(c => {
                return c.sub_id.toLowerCase().includes(convSearch) ||
                       c.country.toLowerCase().includes(convSearch);
            });

            if (searchedConversions.length === 0) {
                tbodyConv.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Tidak ada data konversi.</td></tr>';
            } else {
                searchedConversions.forEach(c => {
                    const formattedTime = formatDateTimeByOffset(c.isoDate, selectedTimezoneOffset);
                    const dev = c.deviceInfo || { osIcon: 'fa-desktop', osName: 'Desktop' };
                    const isTop = (c.sub_id === topSubId);
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = \`
                        <td>\${formattedTime}</td>
                        <td>
                            <span class="badge-subid">
                                \${isTop ? '👑 ' : ''}\${c.sub_id}
                            </span>
                        </td>
                        <td><span class="flag-icon">\${c.flag || '🌐'}</span> \${c.country}</td>
                        <td>
                            <div class="device-badge">
                                <i class="fa-brands \${dev.osIcon}"></i> \${dev.osName}
                            </div>
                        </td>
                        <td><strong style="color:#10b981">\${c.amount}</strong></td>
                    \`;
                    tbodyConv.appendChild(tr);
                });
            }

            // RENDER TAB LIVE CLICK (100 KLIK TERBARU TANPA FILTER DENGAN TAMPILAN POLOS)
            const tbodyClick = document.getElementById('tbl-click');
            tbodyClick.innerHTML = '';
            
            const limitedClicksForDisplay = allClicks.slice(0, 100);

            if (limitedClicksForDisplay.length === 0) {
                tbodyClick.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Tidak ada data klik.</td></tr>';
            } else {
                limitedClicksForDisplay.forEach(c => {
                    const formattedTime = formatDateTimeByOffset(c.isoDate, selectedTimezoneOffset);
                    const dev = c.deviceInfo || { osIcon: 'fa-desktop', browserIcon: 'fa-globe', osName: 'Desktop', browserName: 'Browser' };

                    const tr = document.createElement('tr');
                    tr.innerHTML = \`
                        <td>\${formattedTime}</td>
                        <td><span class="badge-subid">\${c.sub_id}</span></td>
                        <td><code>\${c.ip}</code></td>
                        <td><span class="flag-icon">\${c.flag || '🌐'}</span> \${c.country}</td>
                        <td>
                            <div class="device-badge">
                                <i class="fa-brands \${dev.osIcon}"></i>
                                <i class="fa-brands \${dev.browserIcon}"></i>
                            </div>
                        </td>
                    \`;
                    tbodyClick.appendChild(tr);
                });
            }

            // RENDER TOTAL PERFORMANCE PER SUB ID
            const tbodySubId = document.getElementById('tbl-subid-body');
            tbodySubId.innerHTML = '';

            let subIdKeys = Object.keys(subIdStats).filter(key => key.toLowerCase().includes(subIdSearch));

            subIdKeys.sort((a, b) => subIdStats[b].revenue - subIdStats[a].revenue);

            if (subIdKeys.length === 0) {
                tbodySubId.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">Tidak ada data Sub ID.</td></tr>';
                return;
            }

            subIdKeys.forEach(subId => {
                const item = subIdStats[subId];
                const uCount = item.uniques.size;
                const cr = uCount > 0 ? ((item.conversions / uCount) * 100).toFixed(2) : '0.00';
                const isExpanded = expandedSubIds.has(subId);
                const isTop = (subId === topSubId);

                const tr = document.createElement('tr');
                tr.className = 'clickable-row';
                tr.onclick = () => toggleSubIdExpand(subId);

                tr.innerHTML = \`
                    <td>
                        <span class="badge-subid">
                            \${isTop ? '👑 ' : ''}\${subId}
                        </span>
                    </td>
                    <td>\${item.clicks}</td>
                    <td><strong style="color:#8b5cf6;">\${uCount}</strong></td>
                    <td><strong>\${item.conversions}</strong></td>
                    <td><strong style="color:#3b82f6;">\${cr}%</strong></td>
                    <td><strong style="color:#10b981;">$\${item.revenue.toFixed(2)}</strong></td>
                \`;
                tbodySubId.appendChild(tr);

                if (isExpanded) {
                    const detailTr = document.createElement('tr');
                    let countryKeys = Object.keys(item.countries);

                    // PENGURUTAN DETAIL NEGARA: REVENUE TERBESAR, JIKA 0 URUTKAN DARI KLIK TERBANYAK
                    countryKeys.sort((a, b) => {
                        const revA = item.countries[a].revenue;
                        const revB = item.countries[b].revenue;
                        if (revB !== revA) {
                            return revB - revA;
                        }
                        return item.countries[b].clicks - item.countries[a].clicks;
                    });

                    let countryRowsHtml = '';
                    countryKeys.forEach(cName => {
                        const cData = item.countries[cName];
                        const cUniques = cData.uniques.size;
                        const cCr = cUniques > 0 ? ((cData.conversions / cUniques) * 100).toFixed(2) : '0.00';

                        countryRowsHtml += \`
                            <tr>
                                <td><span class="flag-icon">\${cData.flag}</span> \${cName}</td>
                                <td>\${cData.clicks}</td>
                                <td><strong style="color:#8b5cf6;">\${cUniques}</strong></td>
                                <td><strong>\${cData.conversions}</strong></td>
                                <td><strong style="color:#3b82f6;">\${cCr}%</strong></td>
                                <td><strong style="color:#10b981;">$\${cData.revenue.toFixed(2)}</strong></td>
                            </tr>
                        \`;
                    });

                    detailTr.innerHTML = \`
                        <td colspan="6" style="padding:0;">
                            <div class="country-detail-container">
                                <div style="font-size:11px; font-weight:bold; color:#38bdf8; margin-bottom:4px;">
                                    🌍 BREAKDOWN NEGARA UNTUK SUB ID: <span style="text-decoration:underline;">\${subId}</span>
                                </div>
                                <div class="table-responsive">
                                    <table class="country-detail-table">
                                        <thead>
                                            <tr>
                                                <th>Negara</th>
                                                <th>Clicks</th>
                                                <th>Uniques</th>
                                                <th>Conversions</th>
                                                <th>CR (%)</th>
                                                <th>Revenue ($)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            \${countryRowsHtml}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </td>
                    \`;
                    tbodySubId.appendChild(detailTr);
                }
            });
        }

        function triggerClick() {
            const subId = document.getElementById('sim-subid').value;
            fetch('/api/track-click', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sub_id: subId })
            });
        }

        function triggerConv() {
            const subId = document.getElementById('sim-subid').value;
            fetch('/api/track-conversion', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sub_id: subId })
            });
        }

        function triggerForceLogout() {
            if (confirm("Keluarkan seluruh sesi pengguna aktif?")) {
                fetch('/api/force-logout', { method: 'POST' });
            }
        }

        initTheme();
        checkSession();
        fetchInitialData();
        updateClock();
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});
