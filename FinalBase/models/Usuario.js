// FinalBase/models/Usuario.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UsuarioSchema = new mongoose.Schema({
    nombreUsuario: {
        type: String,
        required: [true, 'El nombre de usuario es obligatorio.'],
        unique: true,
        trim: true,
        minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres.']
    },
    email: {
        type: String,
        required: [true, 'El email es obligatorio.'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+\@.+\..+/, 'Por favor, ingrese un email válido.']
    },
    password: {
        type: String,
        required: [true, 'La contraseña es obligatoria.'],
        minlength: [6, 'La contraseña debe tener al menos 6 caracteres.']
    },
    fechaRegistro: {
        type: Date,
        default: Date.now
    }
});

// Middleware (hook) para hashear la contraseña ANTES de que el documento se guarde en la BD
UsuarioSchema.pre('save', async function(next) {
    // Solo hashear la contraseña si ha sido modificada (o es nueva)
    if (!this.isModified('password')) {
        return next();
    }
    try {
        // Generar un "salt" para el hasheo
        const salt = await bcrypt.genSalt(10);
        // Hashear la contraseña con el salt
        this.password = await bcrypt.hash(this.password, salt);
        next(); // Continuar con el proceso de guardado
    } catch (error) {
        next(error); // Pasar el error al siguiente middleware/manejador
    }
});

// Método para comparar la contraseña ingresada con la almacenada (hasheada)
UsuarioSchema.methods.compararPassword = async function(passwordIngresada) {
    return await bcrypt.compare(passwordIngresada, this.password);
};

// El tercer argumento 'Usuario' es el nombre deseado para la colección en MongoDB.
// Mongoose por defecto pluralizaría 'Usuario' a 'usuarios', pero así lo forzamos.
module.exports = mongoose.model('Usuario', UsuarioSchema, 'Usuario');