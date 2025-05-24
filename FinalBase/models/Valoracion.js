const mongoose = require('mongoose');

const ValoracionSchema = new mongoose.Schema({
    id_carrera: Number,
    id_maestro: Number,
    id_materia: Number,
    Ano: Number,
    Nota_materia: String,
    Puntuacion_materia: Number,
    Puntuacion_profesor: Number,
    recomendacion: Number,
    Calidad_profesor: Number,
    Reseña: String
}, { collection: 'Valoracion' });

module.exports = mongoose.models.Valoracion || mongoose.model('Valoracion', ValoracionSchema);