// Add console.log to check if form submission works
document.querySelector('.form').addEventListener('submit', function(e) {
    e.preventDefault();
    console.log('Form submitted');
    
    const username = document.querySelector('input[type="text"]').value;
    const password = document.querySelector('input[type="password"]').value;
    
    console.log('Username:', username);
    console.log('Password:', password);
    
    if (username === "adminmelati" && password === "admin") {
        console.log('Login successful');
        sessionStorage.setItem('isLoggedIn', 'true');
        window.location.href = "admin.html";
    } else {
        alert("Username atau Password salah!");
    }
});