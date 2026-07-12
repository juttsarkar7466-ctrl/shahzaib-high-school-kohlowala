const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'JuttSarkarSecretKey2026!@#',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 60 * 1000 }
}));

// Data Helpers
const getData = (file) => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        if (file === 'credentials.json') {
            const defaultCreds = { email: "juttsarkar7466@gmail.com", password: "JuttSSMarket@2026!" };
            fs.writeFileSync(filePath, JSON.stringify(defaultCreds, null, 2));
            return defaultCreds;
        }
        return [];
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return data ? JSON.parse(data) : [];
};

const saveData = (file, data) => {
    const filePath = path.join(__dirname, file);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Auth Middleware
function isAuthenticated(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.redirect('/admin');
}

// Public APIs
app.get('/api/photos', (req, res) => res.json(getData('photos.json')));
app.get('/api/notices', (req, res) => res.json(getData('notices.json')));

app.get('/api/search-result', (req, res) => {
    const { roll_no, year } = req.query;
    const results = getData('results.json');
    const studentResult = results.find(r => r.roll_no.trim() === roll_no.trim() && r.year.trim() === year.trim());
    if (studentResult) res.json({ success: true, data: studentResult });
    else res.json({ success: false, message: "Result nahi mila! Roll Number ya Saal check karein." });
});

// Form Submissions
app.post('/submit-admission', (req, res) => {
    const admissions = getData('admissions.json');
    admissions.push({ id: Date.now(), ...req.body, date: new Date().toLocaleString() });
    saveData('admissions.json', admissions);
    res.send('<div style="text-align:center;margin-top:50px;font-family:sans-serif;"><h2>Dakhla Form Jama Ho Chuka Hai!</h2><a href="/">Home</a></div>');
});

app.post('/submit-contact', (req, res) => {
    const messages = getData('messages.json');
    messages.push({ id: Date.now(), ...req.body, date: new Date().toLocaleString() });
    saveData('messages.json', messages);
    res.send('<div style="text-align:center;margin-top:50px;font-family:sans-serif;"><h2>Aapka Paigham Bhej Diya Gaya Hai!</h2><a href="/">Home</a></div>');
});

// Admin Authentication
app.get('/admin', (req, res) => {
    if (req.session.isAdmin) return res.redirect('/admin/dashboard');
    res.send(`
        <div style="max-width:400px; margin:100px auto; font-family:sans-serif; padding:30px; border:1px solid #ddd; border-radius:8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <h2 style="text-align:center; color:#0b2240;">Admin Panel Login</h2>
            <form action="/admin/login" method="POST">
                <input type="email" name="email" placeholder="Email Address" required style="width:100%; padding:12px; margin:10px 0; border:1px solid #ccc; border-radius:4px;"><br>
                <input type="password" name="password" placeholder="Password" required style="width:100%; padding:12px; margin:10px 0; border:1px solid #ccc; border-radius:4px;"><br>
                <button type="submit" style="width:100%; padding:12px; background:#0b2240; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Login</button>
            </form>
        </div>
    `);
});

app.post('/admin/login', (req, res) => {
    const creds = getData('credentials.json');
    if (req.body.email === creds.email && req.body.password === creds.password) {
        req.session.isAdmin = true;
        res.redirect('/admin/dashboard');
    } else {
        res.send("<h3>Galat Email ya Password! <a href='/admin'>Dubara Koshish Karein</a></h3>");
    }
});

// Admin Features & Uploads
app.post('/admin/upload-photo', isAuthenticated, (req, res) => {
    const photos = getData('photos.json');
    photos.push({ id: Date.now(), url: req.body.photo_url, caption: req.body.caption });
    saveData('photos.json', photos);
    res.redirect('/admin/dashboard');
});

app.post('/admin/add-notice', isAuthenticated, (req, res) => {
    const notices = getData('notices.json');
    notices.push({ id: Date.now(), text: req.body.notice_text, date: new Date().toLocaleDateString() });
    saveData('notices.json', notices);
    res.redirect('/admin/dashboard');
});

app.post('/admin/upload-result', isAuthenticated, (req, res) => {
    const results = getData('results.json');
    results.push({ id: Date.now(), roll_no: req.body.roll_no, name: req.body.student_name, student_class: req.body.student_class, year: req.body.year, marks: req.body.marks, status: req.body.status });
    saveData('results.json', results);
    res.redirect('/admin/dashboard');
});

app.post('/admin/bulk-upload-results', isAuthenticated, upload.single('csv_file'), (req, res) => {
    if (!req.file) return res.send("<h3>File select nahi ki!</h3>");
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const lines = fileContent.split('\n');
    const results = getData('results.json');
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',');
        if (cols.length >= 6) {
            results.push({ id: Date.now() + i, roll_no: cols[0].trim(), name: cols[1].trim(), student_class: cols[2].trim(), year: cols[3].trim(), marks: cols[4].trim(), status: cols[5].trim() });
        }
    }
    saveData('results.json', results);
    fs.unlinkSync(req.file.path);
    res.send("<h3>🎉 Bulk Data Uploaded!</h3><a href='/admin/dashboard'>Wapas Dashboard</a>");
});

// Change Password Route
app.post('/admin/change-password', isAuthenticated, (req, res) => {
    const creds = getData('credentials.json');
    if (req.body.new_password.trim().length < 5) return res.send("<h3>Password kam se kam 5 lafzon ka hona chahiye!</h3>");
    creds.password = req.body.new_password.trim();
    saveData('credentials.json', creds);
    res.send("<h3>🔐 Password Kamyabi Se Badal Gaya Hai!</h3><a href='/admin/dashboard'>Dashboard par wapas jayein</a>");
});

// Delete Data Endpoints
app.get('/admin/delete/:type/:id', isAuthenticated, (req, res) => {
    const { type, id } = req.params;
    let fileName = `${type}.json`;
    let data = getData(fileName);
    data = data.filter(item => item.id != id);
    saveData(fileName, data);
    res.redirect('/admin/dashboard');
});

// Admin Dashboard UI
app.get('/admin/dashboard', isAuthenticated, (req, res) => {
    const admissions = getData('admissions.json');
    const messages = getData('messages.json');
    const notices = getData('notices.json');
    const photos = getData('photos.json');

    const admissionRows = admissions.map(u => `<tr><td>${u.student_name}</td><td>${u.father_name}</td><td>${u.student_class}</td><td>${u.phone}</td><td><a href="/admin/delete/admissions/${u.id}" style="color:red;font-weight:bold;">Delete</a></td></tr>`).join('');
    const messageRows = messages.map(m => `<tr><td>${m.name}</td><td>${m.phone}</td><td>${m.msg}</td><td>${m.date}</td><td><a href="/admin/delete/messages/${m.id}" style="color:red;font-weight:bold;">Delete</a></td></tr>`).join('');
    const noticeRows = notices.map(n => `<li>${n.text} (${n.date}) - <a href="/admin/delete/notices/${n.id}" style="color:red;">Khatam Karen</a></li>`).join('');
    const photoRows = photos.map(p => `<li>${p.caption} - <a href="/admin/delete/photos/${p.id}" style="color:red;">Delete Photo</a></li>`).join('');

    let yearOptions = ''; for(let y=2026; y>=2010; y--) yearOptions += `<option value="${y}">${y}</option>`;

    res.send(`
        <html lang="en">
        <head><title>Admin Dashboard</title><style>body{font-family:sans-serif;margin:20px;background:#f4f6f9;} th,td{padding:10px;border:1px solid #ddd;text-align:left;} table{width:100%;border-collapse:collapse;background:#fff;margin-top:10px;} .card{background:#fff;padding:20px;border-radius:6px;box-shadow:0 2px 5px rgba(0,0,0,0.05);margin-bottom:20px;} input,select,textarea{width:100%;padding:10px;margin:8px 0;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;}</style></head>
        <body>
            <div style="display:flex;justify-content:between;align-items:center;background:#0b2240;color:white;padding:15px 30px;border-radius:6px;">
                <h2>🏫 Shahzaib High School - Dashboard</h2>
                <a href="/admin/logout" style="background:red;color:white;padding:10px 15px;text-decoration:none;font-weight:bold;border-radius:4px;margin-left:auto;">Logout</a>
            </div>

            <div style="display:flex;gap:20px;margin-top:20px;flex-wrap:wrap;">
                <div class="card" style="flex:1;min-width:250px;background:#fff3cd;">
                    <h3>🔐 Change Admin Password</h3>
                    <form action="/admin/change-password" method="POST">
                        <input type="text" name="new_password" placeholder="Enter New Secure Password" required>
                        <button type="submit" style="background:#28a745;color:white;padding:10px;border:none;cursor:pointer;width:100%;font-weight:bold;">Update Password</button>
                    </form>
                </div>
                <div class="card" style="flex:1;min-width:300px;">
                    <h3>📢 Notice Board (New Announcement)</h3>
                    <form action="/admin/add-notice" method="POST">
                        <input type="text" name="notice_text" placeholder="e.g., Garmiyon ki chuttiyan 15 June se hongi..." required>
                        <button type="submit" style="background:#007bff;color:white;padding:10px;border:none;cursor:pointer;">Publish Announcement</button>
                    </form>
                    <h4>Active Notices:</h4><ul>${noticeRows || '<li>No active elanaat.</li>'}</ul>
                </div>
            </div>

            <div style="display:flex;gap:20px;flex-wrap:wrap;">
                <div class="card" style="flex:1;min-width:300px;">
                    <h3>🖼️ Manage School Photos</h3>
                    <form action="/admin/upload-photo" method="POST">
                        <input type="text" name="photo_url" placeholder="Paste Image Link" required>
                        <input type="text" name="caption" placeholder="Photo Description" required>
                        <button type="submit" style="background:green;color:white;padding:10px;border:none;cursor:pointer;">Add Photo</button>
                    </form>
                    <h4>Current Photos:</h4><ul>${photoRows || '<li>No photos uploaded.</li>'}</ul>
                </div>
                <div class="card" style="flex:2;min-width:400px;">
                    <h3>📊 Add Results (Manual & Bulk CSV)</h3>
                    <form action="/admin/upload-result" method="POST" style="display:flex;flex-wrap:wrap;gap:10px;">
                        <input type="text" name="roll_no" placeholder="Roll No" required style="width:48%;">
                        <input type="text" name="student_name" placeholder="Student Name" required style="width:48%;">
                        <select name="student_class" required style="width:48%;"><option value="">Class</option>${Array.from({length:10},(_,i)=>`<option value="Class ${i+1}">Class ${i+1}</option>`).join('')}</select>
                        <select name="year" required style="width:48%;"><option value="">Year</option>${yearOptions}</select>
                        <input type="text" name="marks" placeholder="Marks (450/500)" required style="width:48%;">
                        <select name="status" style="width:48%;"><option value="Pass">Pass</option><option value="Fail">Fail</option></select>
                        <button type="submit" style="background:blue;color:white;padding:10px 20px;border:none;cursor:pointer;font-weight:bold;border-radius:4px;">Save Single Result</button>
                    </form>
                    <hr style="margin:15px 0;border-top:1px solid #eee;">
                    <form action="/admin/bulk-upload-results" method="POST" enctype="multipart/form-data" style="background:#e2e3e5;padding:15px;border-radius:4px;">
                        <strong>Bulk CSV Upload: </strong><input type="file" name="csv_file" accept=".csv" required style="width:auto;margin-right:10px;">
                        <button type="submit" style="background:#383d41;color:white;padding:8px 15px;border:none;cursor:pointer;">Upload Sheet</button>
                    </form>
                </div>
            </div>

            <div class="card">
                <h3>📥 Received Admission Applications</h3>
                <table><tr style="background:#0b2240;color:white;"><th>Name</th><th>Father Name</th><th>Class</th><th>Phone</th><th>Action</th></tr>${admissionRows || '<tr><td colspan="5" style="text-align:center;color:gray;">No admissions yet.</td></tr>'}</table>
            </div>

            <div class="card" style="background:#fff;">
                <h3>✉️ Parents/Students Inbox (Contact Us Messages)</h3>
                <table><tr style="background:#e3f2fd;"><th>Sender Name</th><th>Phone Number</th><th>Message</th><th>Date Received</th><th>Action</th></tr>${messageRows || '<tr><td colspan="5" style="text-align:center;color:gray;">Inbox khaali hai. Kaunmhi paigham nahi mila.</td></tr>'}</table>
            </div>
        </body>
        </html>
    `);
});

app.get('/admin/logout', (req, res) => { req.session.destroy(() => res.redirect('/admin')); });
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));