const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const useragent = require('express-useragent');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(useragent.express());
app.use(express.json());

// CONFIGURATION
const IMONETIZEIT_BASE_URL = 'https://kebkzw.dlstinguishedate.net/?utm_source=da57dc555e50572d&ban=fb&j1=1&s1=205200&s2=2060889';

const PASSWORDS = {
    admin: 'admin123',
    guest: 'akuuser'
};

// PERSISTENT DATABASE LOGIC (database.json)
const DB_FILE = path.join(__dirname, 'database.json');

let clicksHistory = [];
let conversionsHistory = [];

// Fungsi membaca data dari database.json saat server dinyalakan
function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const rawData = fs.readFileSync(DB_FILE, 'utf8');
            const parsed = JSON.parse(rawData);
            clicksHistory = parsed.clicksHistory || [];
            conversionsHistory = parsed.conversionsHistory || [];
            console.log(`[DB] Berhasil memuat ${clicksHistory.length} data klik & ${conversionsHistory.length} data konversi.`);
        } else {
            saveDatabase();
        }
    } catch (err) {
        console.error('[DB] Gagal memuat database.json:', err.message);
    }
}

// Fungsi menyimpan data ke database.json
function saveDatabase() {
    try {
        const dataToSave = {
            clicksHistory: clicksHistory,
            conversionsHistory: conversionsHistory
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    } catch (err) {
        console.error('[DB] Gagal menyimpan ke database.json:', err.message);
    }
}

loadDatabase();

function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode === 'XX' || countryCode === 'LOCAL') return '🌐';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
}

function getDeviceIcons(ua) {
    let browserIcon = 'fa-globe';
    let osIcon = 'fa-desktop';

    const browser = ua.browser.toLowerCase();
    const os = ua.os.toLowerCase();

    if (browser.includes('chrome')) browserIcon = 'fa-chrome';
    else if (browser.includes('firefox')) browserIcon = 'fa-firefox-browser';
    else if (browser.includes('safari')) browserIcon = 'fa-safari';
    else if (browser.includes('edge')) browserIcon = 'fa-edge';
    else if (browser.includes('opera')) browserIcon = 'fa-opera';

    if (os.includes('android')) osIcon = 'fa-android';
    else if (os.includes('ios') || os.includes('mac')) osIcon = 'fa-apple';
    else if (os.includes('windows')) osIcon = 'fa-windows';
    else if (os.includes('linux')) osIcon = 'fa-linux';
    else if (ua.isMobile) osIcon = 'fa-mobile-screen-button';

    return {
        browserName: ua.browser,
        osName: ua.os,
        browserIcon: browserIcon,
        osIcon: osIcon
    };
}

// Fungsi Geolokasi yang Diperbarui (Mendukung IPv4 & IPv6 via Render Proxy)
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
            return {
                country: countryName,
                countryCode: countryCode,
                flag: flag,
                ip: ip
            };
        }
    } catch (err) {
        try {
            const fallbackRes = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 3000 });
            if (fallbackRes.data && fallbackRes.data.status === 'success') {
                const flag = getFlagEmoji(fallbackRes.data.countryCode);
                return {
                    country: fallbackRes.data.country,
                    countryCode: fallbackRes.data.countryCode,
                    flag: flag,
                    ip: ip
                };
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
    const deviceInfo = getDeviceIcons(req.useragent);
    const now = new Date();

    const clickObj = {
        id: Date.now() + Math.random(),
        isoDate: now.toISOString(),
        sub_id: subId,
        ip: geo.ip,
        country: geo.country,
        flag: geo.flag,
        deviceInfo: deviceInfo,
        visitorKey: `${geo.ip}_${req.useragent.source}`
    };

    clicksHistory.unshift(clickObj);
    saveDatabase();
    io.emit('new-click', clickObj);

    // Format URL Akhir (Hanya mengisi s3, s5, dan click_id)
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

app.get('/api/initial-data', (req, res) => {
    res.json({
        clicksHistory: clicksHistory,
        conversionsHistory: conversionsHistory
    });
});

app.post('/api/track-click', async (req, res) => {
    const subId = req.body.sub_id || req.query.sub_id || 'sub1';
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const geo = await getGeoLocation(clientIp);
    const deviceInfo = getDeviceIcons(req.useragent);
    const now = new Date();

    const clickObj = {
        id: Date.now() + Math.random(),
        isoDate: now.toISOString(),
        sub_id: subId,
        ip: geo.ip,
        country: geo.country,
        flag: geo.flag,
        deviceInfo: deviceInfo,
        visitorKey: `${geo.ip}_${req.useragent.source}`
    };

    clicksHistory.unshift(clickObj);
    saveDatabase();
    io.emit('new-click', clickObj);
    res.json({ status: 'ok' });
});

app.post('/api/track-conversion', async (req, res) => {
    const subId = req.body.sub_id || req.query.sub_id || 'sub1';
    let amountVal = parseFloat(req.body.amount || req.query.amount);
    
    if (isNaN(amountVal)) {
        amountVal = parseFloat((Math.random() * 90 + 10).toFixed(2));
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const geo = await getGeoLocation(clientIp);
    const deviceInfo = getDeviceIcons(req.useragent);
    const now = new Date();

    const convObj = {
        id: Date.now() + Math.random(),
        isoDate: now.toISOString(),
        sub_id: subId,
        ip: geo.ip,
        country: geo.country,
        flag: geo.flag,
        deviceInfo: deviceInfo,
        amountVal: amountVal,
        amount: '$' + amountVal.toFixed(2),
        visitorKey: `${geo.ip}_${req.useragent.source}`
    };

    conversionsHistory.unshift(convObj);
    saveDatabase();
    io.emit('new-conversion', convObj);
    res.json({ status: 'ok' });
});

// Serve Dashboard UI
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        }

        * { 
            box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; 
            transition: background-color 0.2s, color 0.2s;
            -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;
        }

        input {
            -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; user-select: text;
        }

        body { background: var(--bg-color); color: var(--text-color); }

        #loginOverlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #0f172a; z-index: 99999; display: flex; align-items: center; justify-content: center;
        }
        .login-card {
            background: #1e293b; padding: 35px 30px; border-radius: 12px; width: 340px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; color: white;
        }
        .login-title {
            font-size: 32px; font-weight: 800; color: #38bdf8; letter-spacing: 1.5px;
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
        .login-card button:hover { background: #2563eb; }
        .login-error { color: #ef4444; font-size: 13px; margin-top: 10px; display: none; }
        
        header { 
            background: var(--header-bg); color: white; padding: 15px 20px; 
            display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px; 
            position: relative;
        }
        .header-left { display: flex; align-items: center; gap: 15px; }
        
        .header-center-title {
            position: absolute; left: 50%; transform: translateX(-50%);
            font-size: 24px; font-weight: 800; color: #38bdf8; letter-spacing: 2px; text-transform: uppercase;
        }
        @media (max-width: 900px) {
            .header-center-title { position: static; transform: none; width: 100%; text-align: center; order: 3; }
        }

        .header-right { display: flex; align-items: center; gap: 12px; }

        .clock-container {
            display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.2);
            border: 1px solid #334155; padding: 6px 12px; border-radius: 6px;
        }
        .timezone-select {
            background: #1e293b; color: #38bdf8; border: 1px solid #475569;
            padding: 4px 8px; border-radius: 4px; font-size: 13px; font-weight: bold; cursor: pointer; outline: none;
        }
        .utc-clock-box { font-size: 14px; color: #38bdf8; font-weight: bold; font-family: monospace; }

        .btn-theme, .btn-logout {
            background: #334155; color: white; border: none; padding: 8px 12px;
            border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;
        }
        .btn-theme:hover, .btn-logout:hover { background: #475569; }

        .btn-menu {
            background: #3b82f6; color: white; border: none; padding: 10px 18px;
            font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer;
        }
        .btn-menu:hover { background: #2563eb; }

        .menu-dropdown {
            display: none; position: absolute; top: 65px; left: 15px;
            background: #0f172a; border-radius: 8px; padding: 15px; width: 320px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 9999; color: white;
        }
        .menu-dropdown.show { display: block !important; }
        .menu-dropdown button.menu-item { 
            display: block; width: 100%; text-align: left; background: none; border: none;
            color: #cbd5e1; padding: 12px 0; font-size: 15px; cursor: pointer;
            border-bottom: 1px solid #334155; 
        }
        .menu-dropdown button.menu-item:hover { color: white; }
        
        .test-box { margin-top: 15px; background: #1e293b; padding: 12px; border-radius: 6px; border: 1px solid #334155; }
        .test-box input, .test-box select, .test-box button { width: 100%; margin-top: 8px; padding: 8px; border-radius: 4px; border: none; }
        .test-box input { background: #0f172a; color: white; border: 1px solid #334155; }
        .test-box button { background: #10b981; color: white; cursor: pointer; font-weight: bold; }
        .btn-force-logout { background: #ef4444 !important; margin-top: 15px !important; }

        #main { padding: 20px; }
        .panel { background: var(--panel-bg); padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-top: 10px; }
        
        .filter-bar {
            display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
            background: var(--sub-panel-bg); padding: 12px; border-radius: 6px; margin-bottom: 15px;
        }
        .filter-bar input[type="text"] {
            padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 5px; font-size: 14px; outline: none;
            background: var(--panel-bg); color: var(--text-color);
        }
        .btn-preset {
            padding: 8px 12px; background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 5px;
            cursor: pointer; font-size: 13px; font-weight: bold; color: var(--text-color);
        }
        .btn-preset:hover { background: var(--border-color); }
        
        .badge-subid { background: var(--badge-bg); color: var(--badge-text); padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
        .flag-icon { font-size: 18px; margin-right: 6px; vertical-align: middle; }
        
        .device-badge {
            display: inline-flex; align-items: center; gap: 6px;
            background: var(--sub-panel-bg); padding: 4px 8px; border-radius: 4px; font-size: 13px; color: var(--text-color);
        }
        .device-badge i { font-size: 14px; color: #3b82f6; }

        .hidden { display: none !important; }
        
        table { width: 100%; border-collapse: collapse; text-align: left; margin-top: 5px; }
        th, td { padding: 12px 10px; border-bottom: 1px solid var(--border-color); font-size: 14px; }
        th { background: var(--table-header); }
        tfoot tr { background: var(--table-header); font-weight: bold; }
        
        .highlight { animation: flash 1.5s ease-out; }
        @keyframes flash { 0% { background: #dbeafe; } 100% { background: transparent; } }
    </style>
</head>
<body>

    <div id="loginOverlay">
        <div class="login-card">
            <div class="login-title">JossJiss</div>
            <div class="login-subtitle">Realtime Analytics System</div>
            <input type="password" id="passInput" placeholder="Masukkan Password..." onkeyup="if(event.key==='Enter') attemptLogin()">
            <button onclick="attemptLogin()">LOGIN</button>
            <div id="loginError" class="login-error">Password Salah!</div>
        </div>
    </div>

    <header>
        <div class="header-left">
            <button class="btn-menu" id="toggleBtn">☰ Menu</button>
        </div>

        <div class="header-center-title">
            JossJiss
        </div>

        <div class="header-right">
            <div class="clock-container">
                <select id="tzSelect" class="timezone-select" onchange="onTimezoneChange()">
                    <option value="0" selected>UTC +0</option>
                    <option value="7">UTC +7 (WIB)</option>
                </select>
                <div class="utc-clock-box">
                    <span id="liveClock">Loading Clock...</span>
                </div>
            </div>

            <button class="btn-theme" onclick="toggleTheme()" title="Ubah Tema">
                <i id="themeIcon" class="fa-solid fa-moon"></i>
            </button>

            <button class="btn-logout" onclick="logoutCurrentSession()" title="Logout">
                <i class="fa-solid fa-right-from-bracket"></i> Logout
            </button>
        </div>
    </header>

    <div id="navMenu" class="menu-dropdown">
        <h4 style="margin-bottom:10px; color:#94a3b8;">NAVIGASI VIEWS</h4>
        <button class="menu-item" onclick="switchView('subid')">📊 Total Performance per Sub ID</button>
        <button class="menu-item" onclick="switchView('conversion')">🛒 Live Conversion</button>
        <button class="menu-item" onclick="switchView('click')">⚡ Live Klik</button>

        <div id="adminPanel" class="test-box hidden">
            <!-- SMARTLINK GENERATOR -->
            <p style="font-size:12px; font-weight:bold; color:#38bdf8;">🔗 SMARTLINK GENERATOR:</p>
            <input type="text" id="genSubId" placeholder="Ketik Sub ID (misal: fb_ads)...">
            <button onclick="generateLink()" style="background:#3b82f6;">Buat Link Tracking</button>
            
            <div id="genResultBox" style="display:none; margin-top:10px;">
                <input type="text" id="generatedUrl" readonly onclick="this.select()" style="font-size:12px; color:#10b981;">
                <button onclick="copyGeneratedLink()" style="background:#059669; margin-top:5px;">📋 Salin Link</button>
            </div>

            <hr style="border:0; border-top:1px solid #334155; margin:15px 0;">

            <!-- SIMULATOR -->
            <p style="font-size:12px; font-weight:bold; color:#10b981;">⚡ SIMULATOR:</p>
            <select id="sim-subid">
                <option value="sub1">Sub ID: sub1</option>
                <option value="sub2">Sub ID: sub2</option>
                <option value="sub3">Sub ID: sub3</option>
                <option value="campaign_fb">Sub ID: campaign_fb</option>
            </select>
            <button onclick="triggerClick()">Simulasi Klik / Hit</button>
            <button onclick="triggerConv()">Simulasi Konversi</button>
            
            <button class="btn-force-logout" onclick="triggerForceLogout()">🔒 Force Logout All Users</button>
        </div>
    </div>

    <div id="main">

        <div class="filter-bar">
            <strong>📅 Filter Tanggal:</strong>
            <input type="text" id="startDatePicker" placeholder="Dari Tanggal" style="width: 140px;">
            <input type="text" id="endDatePicker" placeholder="Sampai Tanggal" style="width: 140px;">
            
            <button class="btn-preset" onclick="setPreset('week')">Minggu Ini (Week)</button>
            <button class="btn-preset" onclick="setPreset('month')">Bulan Ini (Month)</button>
            <button class="btn-preset" onclick="resetDateFilter()">Reset Tanggal</button>
        </div>
        
        <section id="subid-sec" class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                <h2>📊 Performance Summary per Sub ID</h2>
                <input type="text" id="searchSubId" placeholder="🔍 Cari Sub ID..." onkeyup="renderAnalytics()" style="padding: 8px 12px; width: 220px; border: 1px solid var(--border-color); border-radius: 5px;">
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Sub ID</th>
                        <th>Hits</th>
                        <th>Clicks</th>
                        <th>Uniques</th>
                        <th>Conversions</th>
                        <th>CR (%)</th>
                        <th>Revenue ($)</th>
                    </tr>
                </thead>
                <tbody id="tbl-subid-body"></tbody>
                <tfoot>
                    <tr>
                        <td>TOTAL OVERALL</td>
                        <td id="total-overall-hits">0</td>
                        <td id="total-overall-clicks">0</td>
                        <td id="total-overall-uniques" style="color:#8b5cf6;">0</td>
                        <td id="total-overall-conversions">0</td>
                        <td id="total-overall-cr" style="color:#3b82f6;">0.00%</td>
                        <td id="total-overall-revenue" style="color:#10b981;">$0.00</td>
                    </tr>
                </tfoot>
            </table>
        </section>

        <section id="conv-sec" class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                <h2>🛒 Live Conversion</h2>
                <input type="text" id="searchConv" placeholder="🔍 Cari IP, Sub ID, Negara..." onkeyup="renderAnalytics()" style="padding: 8px 12px; width: 250px; border: 1px solid var(--border-color); border-radius: 5px;">
            </div>
            <table>
                <thead>
                    <tr><th class="th-time">Waktu (UTC+0)</th><th>Sub ID</th><th>IP</th><th>Negara</th><th>Perangkat & App</th><th>Value ($)</th></tr>
                </thead>
                <tbody id="tbl-conv"></tbody>
            </table>
        </section>

        <section id="click-sec" class="panel hidden">
            <h2>⚡ Live Klik</h2>
            <table>
                <thead>
                    <tr><th class="th-time">Waktu (UTC+0)</th><th>Sub ID</th><th>IP</th><th>Negara</th><th>Perangkat & App</th></tr>
                </thead>
                <tbody id="tbl-click"></tbody>
            </table>
        </section>

    </div>

    <script>
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'F12') {
                e.preventDefault();
            }
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
                e.preventDefault();
            }
            if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
                e.preventDefault();
            }
        });

        let userRole = localStorage.getItem('user_role') || null;

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
                    renderAnalytics();
                }
            } catch (err) {
                console.error("Gagal memuat data awal:", err);
            }
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
            const icon = document.getElementById('themeIcon');
            if (theme === 'dark') {
                icon.className = 'fa-solid fa-sun';
            } else {
                icon.className = 'fa-solid fa-moon';
            }
        }

        let selectedTimezoneOffset = 0;

        function onTimezoneChange() {
            selectedTimezoneOffset = parseInt(document.getElementById('tzSelect').value);
            const label = selectedTimezoneOffset === 7 ? 'Waktu (UTC+7 / WIB)' : 'Waktu (UTC+0)';
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

            const tzLabel = offsetHours === 7 ? 'WIB' : 'UTC';
            return \`\${year}-\${month}-\${day} \${hours}:\${minutes}:\${seconds} \${tzLabel}\`;
        }

        function updateClock() {
            const nowIso = new Date().toISOString();
            document.getElementById('liveClock').innerText = formatDateTimeByOffset(nowIso, selectedTimezoneOffset);
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
                renderAnalytics();
            }
        });

        function setPreset(preset) {
            const now = new Date();
            let start = new Date();
            
            if (preset === 'week') {
                const day = now.getUTCDay() || 7;
                start.setUTCDate(now.getUTCDate() - day + 1);
                start.setUTCHours(0, 0, 0, 0);
            } else if (preset === 'month') {
                start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
            }

            fpStart.setDate(start);
            fpEnd.setDate(now);

            filterStartDate = start;
            filterEndDate = new Date();
            filterEndDate.setHours(23, 59, 59, 999);

            renderAnalytics();
        }

        function resetDateFilter() {
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
            const subidSec = document.getElementById('subid-sec');
            const convSec = document.getElementById('conv-sec');
            const clickSec = document.getElementById('click-sec');

            subidSec.classList.add('hidden');
            convSec.classList.add('hidden');
            clickSec.classList.add('hidden');

            if (viewType === 'subid') {
                subidSec.classList.remove('hidden');
            } else if (viewType === 'click') {
                clickSec.classList.remove('hidden');
            } else {
                convSec.classList.remove('hidden');
            }

            menu.classList.remove('show');
        }

        const socket = io();

        socket.on('force-logout-all', () => {
            alert('🔒 Akses Anda telah dikeluarkan oleh Admin!');
            logoutCurrentSession();
        });

        socket.on('new-click', (data) => {
            allClicks.unshift(data);
            renderAnalytics();
        });

        socket.on('new-conversion', (data) => {
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

            const tbodyConv = document.getElementById('tbl-conv');
            tbodyConv.innerHTML = '';
            
            const searchedConversions = filteredConversions.filter(c => {
                return c.sub_id.toLowerCase().includes(convSearch) ||
                       c.ip.toLowerCase().includes(convSearch) ||
                       c.country.toLowerCase().includes(convSearch);
            });

            if (searchedConversions.length === 0) {
                tbodyConv.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">Tidak ada data konversi.</td></tr>';
            } else {
                searchedConversions.forEach(c => {
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
                                <i class="fa-brands \${dev.osIcon}"></i> \${dev.osName}
                                <span>•</span>
                                <i class="fa-brands \${dev.browserIcon}"></i> \${dev.browserName}
                            </div>
                        </td>
                        <td><strong style="color:#10b981">\${c.amount}</strong></td>
                    \`;
                    tbodyConv.appendChild(tr);
                });
            }

            const tbodyClick = document.getElementById('tbl-click');
            tbodyClick.innerHTML = '';
            if (filteredClicks.length === 0) {
                tbodyClick.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Tidak ada data klik.</td></tr>';
            } else {
                filteredClicks.forEach(c => {
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
                                <i class="fa-brands \${dev.osIcon}"></i> \${dev.osName}
                                <span>•</span>
                                <i class="fa-brands \${dev.browserIcon}"></i> \${dev.browserName}
                            </div>
                        </td>
                    \`;
                    tbodyClick.appendChild(tr);
                });
            }

            const subIdStats = {};
            const globalUniques = new Set();
            let totalHits = 0, totalClicks = 0, totalConversions = 0, totalRevenue = 0;

            filteredClicks.forEach(c => {
                totalHits++;
                totalClicks++;
                globalUniques.add(c.visitorKey);

                if (!subIdStats[c.sub_id]) {
                    subIdStats[c.sub_id] = { hits: 0, clicks: 0, conversions: 0, revenue: 0, uniques: new Set() };
                }
                subIdStats[c.sub_id].hits++;
                subIdStats[c.sub_id].clicks++;
                subIdStats[c.sub_id].uniques.add(c.visitorKey);
            });

            filteredConversions.forEach(c => {
                totalConversions++;
                totalRevenue += c.amountVal;

                if (!subIdStats[c.sub_id]) {
                    subIdStats[c.sub_id] = { hits: 0, clicks: 0, conversions: 0, revenue: 0, uniques: new Set() };
                }
                subIdStats[c.sub_id].conversions++;
                subIdStats[c.sub_id].revenue += c.amountVal;
            });

            document.getElementById('total-overall-hits').innerText = totalHits;
            document.getElementById('total-overall-clicks').innerText = totalClicks;
            document.getElementById('total-overall-uniques').innerText = globalUniques.size;
            document.getElementById('total-overall-conversions').innerText = totalConversions;
            document.getElementById('total-overall-cr').innerText = (globalUniques.size > 0 ? ((totalConversions / globalUniques.size) * 100).toFixed(2) : '0.00') + '%';
            document.getElementById('total-overall-revenue').innerText = '$' + totalRevenue.toFixed(2);

            const tbodySubId = document.getElementById('tbl-subid-body');
            tbodySubId.innerHTML = '';

            let subIdKeys = Object.keys(subIdStats).filter(key => key.toLowerCase().includes(subIdSearch));

            if (subIdKeys.length === 0) {
                tbodySubId.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Tidak ada data Sub ID yang ditemukan.</td></tr>';
                return;
            }

            subIdKeys.forEach(subId => {
                const item = subIdStats[subId];
                const uCount = item.uniques.size;
                const cr = uCount > 0 ? ((item.conversions / uCount) * 100).toFixed(2) : '0.00';

                const tr = document.createElement('tr');
                tr.innerHTML = \`
                    <td><span class="badge-subid">\${subId}</span></td>
                    <td>\${item.hits}</td>
                    <td>\${item.clicks}</td>
                    <td><strong style="color:#8b5cf6;">\${uCount}</strong></td>
                    <td><strong>\${item.conversions}</strong></td>
                    <td><strong style="color:#3b82f6;">\${cr}%</strong></td>
                    <td><strong style="color:#10b981;">$\${item.revenue.toFixed(2)}</strong></td>
                \`;
                tbodySubId.appendChild(tr);
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
            if (confirm("Apakah Anda yakin ingin mengeluarkan seluruh sesi pengguna yang aktif?")) {
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

server.listen(3000, () => {
    console.log("Server berjalan di http://localhost:3000");
});
