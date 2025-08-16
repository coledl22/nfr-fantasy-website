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

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
