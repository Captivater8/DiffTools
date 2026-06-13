const mongoose = require('mongoose');

const ComparisonSchema = new mongoose.Schema({
    title: { type: String, required: true },
    textA: { type: String, required: true },
    textB: { type: String, required: true },
    algorithm: { type: String, enum: ['myers', 'histogram', 'gumtree'], required: true },
    diffResult: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comparison', ComparisonSchema);
