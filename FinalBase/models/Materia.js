const mongoose = require('mongoose');

const MateriaSchema = new mongoose.Schema({
    id_materia: Number,
    Materia: String
}, { collection: 'Materia' });

module.exports = mongoose.models.Materia || mongoose.model('Materia', MateriaSchema);

