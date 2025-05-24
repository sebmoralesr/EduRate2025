const mongoose = require('mongoose');

const DocenteSchema = new mongoose.Schema({
    id_maestro: Number,
    Nombre_profesor: String,
    Apellido_profesor: String
}, { collection: 'Docente' });

module.exports = mongoose.models.Docente || mongoose.model('Docente', DocenteSchema);