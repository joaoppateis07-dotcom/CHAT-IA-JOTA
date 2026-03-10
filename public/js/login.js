// Matrix effect canvas
const canvas = document.getElementById('matrix-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const matrixChars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
const fontSize = 14;
const columns = canvas.width / fontSize;
const drops = Array(Math.floor(columns)).fill(1);

function drawMatrix() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#00ff41';
    ctx.font = fontSize + 'px monospace';

    for (let i = 0; i < drops.length; i++) {
        const text = matrixChars[Math.floor(Math.random() * matrixChars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
        }
        drops[i]++;
    }
}

setInterval(drawMatrix, 35);

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Login form submission
const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = '';

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const submitBtn = loginForm.querySelector('.submit-btn');
    submitBtn.classList.add('loading');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (response.ok) {
            // Success - create terminal login effect
            document.querySelector('.terminal-body').innerHTML = `
                <div class="terminal-output" style="text-align: center; padding: 50px 20px;">
                    <p class="typing-text" style="animation-delay: 0s;">> Authentication successful</p>
                    <p class="typing-text" style="animation-delay: 0.3s;">> Welcome back, ${data.username}</p>
                    <p class="typing-text" style="animation-delay: 0.6s;">> Initializing JOTA IA interface...</p>
                    <p class="typing-text" style="animation-delay: 0.9s;">> Loading neural networks...</p>
                    <p class="typing-text" style="animation-delay: 1.2s; color: #00ff41; font-weight: bold;">> ACCESS GRANTED</p>
                </div>
            `;

            setTimeout(() => {
                window.location.href = '/chat';
            }, 2000);
        } else {
            submitBtn.classList.remove('loading');
            errorDiv.textContent = '> ERROR: ' + data.error;
        }
    } catch (error) {
        submitBtn.classList.remove('loading');
        errorDiv.textContent = '> ERROR: Connection failed';
    }
});

// Input hover effects
const inputs = document.querySelectorAll('input');
inputs.forEach(input => {
    input.addEventListener('focus', function() {
        this.parentNode.classList.add('focused');
    });
    input.addEventListener('blur', function() {
        this.parentNode.classList.remove('focused');
    });
});

// Button sound effect (optional - visual feedback)
const buttons = document.querySelectorAll('button');
buttons.forEach(button => {
    button.addEventListener('click', function() {
        this.style.transform = 'scale(0.98)';
        setTimeout(() => {
            this.style.transform = '';
        }, 100);
    });
});
