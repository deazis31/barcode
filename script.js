let users = JSON.parse(localStorage.getItem('users')) || [];
let attendance = JSON.parse(localStorage.getItem('attendance')) || [];
let config = JSON.parse(localStorage.getItem('config')) || {
    workStart: '08:00',
    workEnd: '17:00',
    lateTolerance: 15
};
let currentUserRole = 'Admin'; // Simulate logged-in user role (hardcoded for demo)
let isScannerActive = false;

function showSection(sectionId) {
    if (sectionId === 'user-management' && currentUserRole !== 'Admin') {
        alert('Access denied: Only Admins can manage users.');
        return;
    }
    if (sectionId === 'config' && currentUserRole !== 'Admin') {
        alert('Access denied: Only Admins can configure the system.');
        return;
    }
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.querySelector(`[onclick="showSection('${sectionId}')"]`).classList.add('active');
    document.getElementById(sectionId).classList.add('active');

    // Start or stop scanner when switching to/from scanner section
    if (sectionId === 'scanner') {
        startScanner();
    } else {
        stopScanner();
    }
}

function addUser() {
    if (currentUserRole !== 'Admin') {
        alert('Access denied: Only Admins can add users.');
        return;
    }
    const name = document.getElementById('user-name').value;
    const id = document.getElementById('user-id').value;
    const department = document.getElementById('user-department').value;
    const role = document.getElementById('user-role').value;

    if (name && id && department && role) {
        if (users.some(u => u.id === id)) {
            alert('User ID already exists.');
            return;
        }
        users.push({ name, id, department, role });
        localStorage.setItem('users', JSON.stringify(users));
        updateUserTable();
        updateBarcodeUserSelect();
        clearUserForm();
    } else {
        alert('Please fill all fields.');
    }
}

function updateUserTable() {
    const tbody = document.querySelector('#user-table tbody');
    tbody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.name}</td>
            <td>${user.id}</td>
            <td>${user.department}</td>
            <td>${user.role}</td>
            <td>
                <button class="btn" onclick="editUser('${user.id}')">Edit</button>
                <button class="btn" onclick="deleteUser('${user.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function editUser(id) {
    if (currentUserRole !== 'Admin') {
        alert('Access denied: Only Admins can edit users.');
        return;
    }
    const user = users.find(u => u.id === id);
    if (user) {
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-department').value = user.department;
        document.getElementById('user-role').value = user.role;
        deleteUser(id);
    }
}

function deleteUser(id) {
    if (currentUserRole !== 'Admin') {
        alert('Access denied: Only Admins can delete users.');
        return;
    }
    users = users.filter(u => u.id !== id);
    localStorage.setItem('users', JSON.stringify(users));
    updateUserTable();
    updateBarcodeUserSelect();
}

function clearUserForm() {
    document.getElementById('user-name').value = '';
    document.getElementById('user-id').value = '';
    document.getElementById('user-department').value = '';
    document.getElementById('user-role').value = 'Employee';
}

function updateBarcodeUserSelect() {
    const select = document.getElementById('barcode-user');
    select.innerHTML = '<option value="">Select a user</option>';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.name} (${user.id})`;
        select.appendChild(option);
    });
}

function generateBarcode() {
    const userId = document.getElementById('barcode-user').value;
    if (userId) {
        JsBarcode("#barcode", userId, { format: "CODE128", displayValue: true });
    } else {
        alert('Please select a user.');
    }
}

function downloadBarcode() {
    const canvas = document.getElementById('barcode');
    const userId = document.getElementById('barcode-user').value;
    if (userId) {
        const link = document.createElement('a');
        link.download = `barcode_${userId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } else {
        alert('Please generate a barcode first.');
    }
}

function scanBarcode(value) {
    const user = users.find(u => u.id === value);
    const notification = document.getElementById('scan-notification');
    const now = new Date();
    const timestamp = now.toLocaleString();
    const workStart = new Date(`${now.toLocaleDateString()} ${config.workStart}`);
    const lateThreshold = new Date(workStart.getTime() + config.lateTolerance * 60000);
    let status = 'Present';
    if (now > lateThreshold) {
        status = 'Late';
    }

    if (user) {
        attendance.push({ userId: user.id, name: user.name, timestamp, status });
        localStorage.setItem('attendance', JSON.stringify(attendance));
        updateAttendanceTable();
        notification.className = 'notification success';
        notification.textContent = `Success: ${user.name} scanned at ${timestamp} (${status})`;
        notification.style.display = 'block';
    } else {
        notification.className = 'notification error';
        notification.textContent = 'Error: Invalid barcode.';
        notification.style.display = 'block';
    }
    document.getElementById('scanner-input').value = '';
    document.getElementById('scanner-input').focus();
    setTimeout(() => { notification.style.display = 'none'; }, 3000);
}

function startScanner() {
    if (isScannerActive) return;
    isScannerActive = true;

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#scanner-viewport'),
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment"
            }
        },
        decoder: {
            readers: ["code_128_reader"]
        }
    }, function(err) {
        if (err) {
            console.error("Quagga init error:", err);
            showNotification("Error initializing camera. Please ensure camera access is allowed.", "error");
            return;
        }
        Quagga.start();
    });

    Quagga.onDetected(function(result) {
        const code = result.codeResult.code;
        scanBarcode(code);
        // Optionally pause scanning briefly to avoid multiple scans
        Quagga.pause();
        setTimeout(() => Quagga.start(), 2000);
    });
}

function stopScanner() {
    if (isScannerActive) {
        Quagga.stop();
        isScannerActive = false;
    }
}

function showNotification(message, type) {
    const notification = document.getElementById('scan-notification');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => { notification.style.display = 'none'; }, 3000);
}

function updateAttendanceTable() {
    const tbody = document.querySelector('#attendance-table tbody');
    tbody.innerHTML = '';
    attendance.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.name}</td>
            <td>${record.userId}</td>
            <td>${record.timestamp}</td>
            <td>${record.status}</td>
        `;
        tbody.appendChild(row);
    });
}

function generateReport() {
    const date = document.getElementById('report-date').value;
    const tbody = document.querySelector('#report-table tbody');
    tbody.innerHTML = '';
    const filteredAttendance = date ? attendance.filter(r => r.timestamp.startsWith(date)) : attendance;
    filteredAttendance.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.name}</td>
            <td>${record.userId}</td>
            <td>${record.timestamp}</td>
            <td>${record.status}</td>
        `;
        tbody.appendChild(row);
    });

    const absentTbody = document.querySelector('#absent-table tbody');
    absentTbody.innerHTML = '';
    const presentIds = new Set(filteredAttendance.map(r => r.userId));
    users.forEach(user => {
        if (!presentIds.has(user.id) && user.role !== 'Admin') {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.name}</td>
                <td>${user.id}</td>
            `;
            absentTbody.appendChild(row);
        }
    });
}

function downloadReport() {
    const date = document.getElementById('report-date').value;
    const filteredAttendance = date ? attendance.filter(r => r.timestamp.startsWith(date)) : attendance;
    let csv = 'Name,ID,Date,Status\n';
    filteredAttendance.forEach(record => {
        csv += `${record.name},${record.userId},${record.timestamp},${record.status}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_report_${date || 'all'}.csv`;
    link.click();
}

function saveConfig() {
    if (currentUserRole !== 'Admin') {
        alert('Access denied: Only Admins can configure the system.');
        return;
    }
    config.workStart = document.getElementById('work-start').value;
    config.workEnd = document.getElementById('work-end').value;
    config.lateTolerance = parseInt(document.getElementById('late-tolerance').value);
    localStorage.setItem('config', JSON.stringify(config));
    alert('Configuration saved.');
}

// Initialize
document.getElementById('work-start').value = config.workStart;
document.getElementById('work-end').value = config.workEnd;
document.getElementById('late-tolerance').value = config.lateTolerance;
updateUserTable();
updateBarcodeUserSelect();
updateAttendanceTable();

// Attach manual scanner input event listener
document.getElementById('scanner-input').addEventListener('input', function() {
    scanBarcode(this.value);
});