const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Mount API routes
app.use('/api', require('./routes/events'));
app.use('/api', require('./routes/teams'));
app.use('/api', require('./routes/results'));


// Endpoint to return available years based on data folders
const fs = require('fs');
const path = require('path');

app.get('/api/available-years', (req, res) => {
    const dataDir = path.join(__dirname, 'data');
    fs.readdir(dataDir, { withFileTypes: true }, (err, files) => {
        if (err) {
            res.status(500).json({ error: 'Could not read data directory' });
            return;
        }
        // Only include directories with 4-digit year names
        const years = files
            .filter(f => f.isDirectory() && /^\d{4}$/.test(f.name))
            .map(f => parseInt(f.name, 10))
            .sort((a, b) => b - a);
        res.json(years);
    });
});

app.listen(PORT, () => {
        console.log(`Backend server running on port ${PORT}`);
});
