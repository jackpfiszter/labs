function generateArt() {
    const canvas = document.getElementById('artCanvas');
    const context = canvas.getContext('2d');
    const width = parseInt(document.getElementById('canvas-width').value, 10);
    const height = parseInt(document.getElementById('canvas-height').value, 10);

    canvas.width = width;
    canvas.height = height;

    // Define sushi-inspired color palette
    const colors = {
        rice: '#ffffff', // White - Rice
        tuna: '#ff4c4c', // Red - Tuna
        salmon: '#ffa07a', // Orange - Salmon
        avocado: '#b2df8a', // Green - Avocado
        nori: '#2f4f4f', // Dark green - Nori (seaweed)
        egg: '#fff700' // Yellow - Tamago (egg)
    };

    // Function to draw rounded rectangles
    function drawRoundedRect(x, y, width, height, radius, color, alpha = 1.0) {
        context.fillStyle = color;
        context.globalAlpha = alpha;
        context.beginPath();
        context.moveTo(x + radius, y);
        context.lineTo(x + width - radius, y);
        context.quadraticCurveTo(x + width, y, x + width, y + radius);
        context.lineTo(x + width, y + height - radius);
        context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        context.lineTo(x + radius, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - radius);
        context.lineTo(x, y + radius);
        context.quadraticCurveTo(x, y, x + radius, y);
        context.closePath();
        context.fill();
        context.globalAlpha = 1.0;
    }

    // Draw a piece of nigiri
    function drawNigiri(x, y, size) {
        // Draw the rice base
        drawRoundedRect(x - size / 2, y - size / 4, size, size / 2, size / 4, colors.rice);

        // Draw the fish on top
        const fishColors = [colors.tuna, colors.salmon, colors.egg];
        const fishColor = fishColors[Math.floor(Math.random() * fishColors.length)];
        drawRoundedRect(x - size / 2, y - size / 4 - size / 8, size, size / 4, size / 8, fishColor);
    }

    // Draw a piece of maki
    function drawMaki(x, y, size) {
        // Draw the nori (seaweed)
        drawRoundedRect(x - size / 2, y - size / 2, size, size, size / 8, colors.nori);

        // Draw the rice inside
        drawRoundedRect(x - size / 2.5, y - size / 2.5, size / 1.25, size / 1.25, size / 10, colors.rice);

        // Draw the filling
        const fillingColors = [colors.tuna, colors.salmon, colors.avocado];
        const fillingColor = fillingColors[Math.floor(Math.random() * fillingColors.length)];
        drawRoundedRect(x - size / 6, y - size / 6, size / 3, size / 3, size / 12, fillingColor);
    }

    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Grid Parameters
    const gridSize = 150; // Increased size for larger sushi pieces
    const totalCols = Math.ceil(width / gridSize);
    const totalRows = Math.ceil(height / gridSize);

    let currentPiece = 0;

    function drawNextPiece() {
        const col = currentPiece % totalCols;
        const row = Math.floor(currentPiece / totalCols);
        
        if (currentPiece < totalCols * totalRows) {
            const x = col * gridSize + gridSize / 2;
            const y = row * gridSize + gridSize / 2;

            if (Math.random() > 0.3) { // Randomly place sushi pieces
                if (Math.random() > 0.5) {
                    drawNigiri(x, y, gridSize);
                } else {
                    drawMaki(x, y, gridSize);
                }
            }

            currentPiece++;
            requestAnimationFrame(drawNextPiece);
        }
    }

    // Start the animation
    drawNextPiece();
}

// Initialize with default art
generateArt();