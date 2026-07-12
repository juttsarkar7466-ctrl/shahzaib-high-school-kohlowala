const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 10000; // Render standard port configuration
const upload = multer({ dest: 'uploads/' });

// 🔗 MongoDB Connection Link
const MONGO_URI = "mongodb+srv://cheeta_db_user:Bea0N89rCALt17Oz@cluster0.z3upua5.mongodb.net/schoolDB?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("🎉 MongoDB Server Se Connect Ho Gaya Hai!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Database Schemas (Models)
const Notice = mongoose.model('Notice', { text: String, date: String });
const Photo = mongoose.model('Photo', { url: String, caption: String });
const Message = mongoose.model('Message', { name: String, phone: String, msg: String, date: String });
const Result = mongoose.model('Result', { roll_no: String, name: String, student_class: String, year: String, marks: String, status: String });
const Creds = mongoose.model('Cred', { email: String, password: String });

// Default Admin Credentials Setup
async function initAdmin() {
    try {
        const count = await Creds.countDocuments();
        if (count === 0) {
            await Creds.create({ email: "juttsarkar7466@gmail.com", password: "JuttSSMarket@2026!" });
            console.log("💼 Default Admin Account Created!");
        }
    } catch (e) {
        console.error("Admin init error:", e);
    }
}
initAdmin();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Production Session Management (Bypass Proxy Issues)
app.use(session({
    secret: 'JuttSarkarSecretKey2026!@#',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 30 * 60 * 1000 }
}));

// Static Files & Root Path Routing Setup
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function isAuthenticated(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.redirect('/admin');
}

// Public APIs
app.get('/api/photos', async (req, res) => res.json(await Photo.find() || []));
app.get('/api/notices', async (req, res) => res.json(await Notice.find() || []));

app.get('/api/search-result', async (req, res) => {
    const { roll_no, year } = req.query;
    if(!roll_no || !year) return res.json({ success: false, message: "Missing params" });
    const studentResult = await Result.findOne({ roll_no: roll_no.trim(), year: year.trim() });
    if (studentResult) res.json({ success: true, data: studentResult });
    else res.json({ success: false, message: "Result nahi mila! Roll Number ya Saal check karein." });
});

// Form Submissions
app.post('/submit-admission', async (req, res) => {
    const Admission = mongoose.model('Admission', { student_name: String, father_name: String, student_class: String, phone: String, address: String, date: String });
    await Admission.create({ ...req.body, date: new Date().toLocaleString() });
    res.send('<div style="text-align:center;margin-top:50px;font-family:sans-serif;"><h2>Dakhla Form Jama Ho Chuka Hai!</h2><a href="/">Home</a></div>');
});

app.post('/submit-contact', async (req, res) => {
    await Message.create({ ...req.body, date: new Date().toLocaleString() });
    res.send('<div style="text-align:center;margin-top:50px;font-family:sans-serif;"><h2>Aapka Paigham Bhej Diya Gaya Hai!</h2><a href="/">Home</a></div>');
});

// Admin Login Panel View
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

app.post('/admin/login', async (req, res) => {
    const creds = await Creds.findOne();
    if (req.body.email === creds.email && req.body.password === creds.password) {
        req.session.isAdmin = true;
        res.redirect('/admin/dashboard');
    } else {
        res.send("<h3>Galat Email ya Password! <a href='/admin'>Dubara Koshish Karein</a></h3>");
    }
});

// Admin Control Panel Actions
app.post('/admin/upload-photo', isAuthenticated, async (req, res) => {
    await Photo.create({ url: req.body.photo_url, caption: req.body.caption });
    res.redirect('/admin/dashboard');
});

app.post('/admin/add-notice', isAuthenticated, async (req, res) => {
    await Notice.create({ text: req.body.notice_text, date: new Date().toLocaleDateString() });
    res.redirect('/admin/dashboard');
});

app.post('/admin/upload-result', isAuthenticated, async (req, res) => {
    await Result.create(req.body);
    res.redirect('/admin/dashboard');
});

app.post('/admin/change-password', isAuthenticated, async (req, res) => {
    if (req.body.new_password.trim().length < 5) return res.send("<h3>Password chota hai!</h3>");
    await Creds.updateOne({}, { password: req.body.new_password.trim() });
    res.send("<h3>🔐 Password Kamyabi Se Badal Gaya!</h3><a href='/admin/dashboard'>Wapas Dashboard</a>");
});

// MongoDB Delete Engine
app.get('/admin/delete/:type/:id', isAuthenticated, async (req, res) => {
    const { type, id } = req.params;
    if (type === 'notices') await Notice.findByIdAndDelete(id);
    if (type === 'photos') await Photo.findByIdAndDelete(id);
    if (type === 'messages') await Message.findByIdAndDelete(id);
    if (type === 'admissions') {
        const Admission = mongoose.model('Admission');
        await Admission.findByIdAndDelete(id);
    }
    res.redirect('/admin/dashboard');
});

// Admin Dashboard Panel Structure
app.get('/admin/dashboard', isAuthenticated, async (req, res) => {
    const Admission = mongoose.model('Admission');
    const admissions = await Admission.find();
    const messages = await Message.find();
    const notices = await Notice.find();
    const photos = await Photo.find();

    const admissionRows = admissions.map(u => `<tr><td>${u.student_name}</td><td>${u.father_name}</td><td>${u.student_class}</td><td>${u.phone}</td><td><a href="/admin/delete/admissions/${u._id}" style="color:red;font-weight:bold;">Delete</a></td></tr>`).join('');
    const messageRows = messages.map(m => `<tr><td>${m.name}</td><td>${m.phone}</td><td>${m.msg}</td><td>${m.date}</td><td><a href="/admin/delete/messages/${m._id}" style="color:red;font-weight:bold;">Delete</a></td></tr>`).join('');
    const noticeRows = notices.map(n => `<li>${n.text} (${n.date}) - <a href="/admin/delete/notices/${n._id}" style="color:red;">Khatam Karen</a></li>`).join('');
    const photoRows = photos.map(p => `<li>${p.caption} - <a href="/admin/delete/photos/${p._id}" style="color:red;">Delete Photo</a></li>`).join('');

    let yearOptions = ''; for(let y=2026; y>=2010; y--) yearOptions += `<option value="${y}">${y}</option>`;

    res.send(`
        <html lang="en">
        <head><title>Admin Dashboard</title><style>body{font-family:sans-serif;margin:20px;background:#f4f6f9;} th,td{padding:10px;border:1px solid #ddd;text-align:left;} table{width:100%;border-collapse:collapse;background:#fff;margin-top:10px;} .card{background:#fff;padding:20px;border-radius:6px;box-shadow:0 2px 5px rgba(0,0,0,0.05);margin-bottom:20px;} input,select,textarea{width:100%;padding:10px;margin:8px 0;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;}</style></head>
        <body>
            <div style="display:flex;justify-content:space-between;align-items:center;background:#0b2240;color:white;padding:15px 30px;border-radius:6px;">
                <h2>🏫 Shahzaib High School - MongoDB Dashboard</h2>
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
                        <input type="text" name="notice_text" placeholder="Announcement text..." required>
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
                    <h3>📊 Add Results</h3>
                    <form action="/admin/upload-result" method="POST" style="display:flex;flex-wrap:wrap;gap:10px;">
                        <input type="text" name="roll_no" placeholder="Roll No" required style="width:48%;">
                        <input type="text" name="student_name" placeholder="Student Name" required style="width:48%;">
                        <select name="student_class" required style="width:48%;"><option value="">Class</option>${Array.from({length:10},(_,i)=>`<option value="Class ${i+1}">Class ${i+1}</option>`).join('')}</select>
                        <select name="year" required style="width:48%;"><option value="">Year</option>${yearOptions}</select>
                        <input type="text" name="marks" placeholder="Marks (450/500)" required style="width:48%;">
                        <select name="status" style="width:48%;"><option value="Pass">Pass</option><option value="Fail">Fail</option></select>
                        <button type="submit" style="background:blue;color:white;padding:10px 20px;border:none;cursor:pointer;font-weight:bold;border-radius:4px;">Save Student Result</button>
                    </form>
                </div>
            </div>
            <div class="card">
                <h3>📥 Received Admission Applications</h3>
                <table><tr style="background:#0b2240;color:white;"><th>Name</th><th>Father Name</th><th>Class</th><th>Phone</th><th>Action</th></tr>${admissionRows || '<tr><td colspan="5" style="text-align:center;color:gray;">No admissions yet.</td></tr>'}</table>
            </div>
            <div class="card">
                <h3>✉️ Parents/Students Inbox</h3>
                <table><tr style="background:#e3f2fd;"><th>Sender Name</th><th>Phone Number</th><th>Message</th><th>Date Received</th><th>Action</th></tr>${messageRows || '<tr><td colspan="5" style="text-align:center;color:gray;">Inbox khaali hai.</td></tr>'}</table>
            </div>
        </body>
        </html>
    `);
});

app.get('/admin/logout', (req, res) => { req.session.destroy(() => res.redirect('/admin')); });

// Open port binding for cloud routers
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running perfectly on port ${PORT}`));
