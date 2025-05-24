// FinalBase/routes/auth.js
const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario'); // Ajusta la ruta si es necesario (../models/Usuario.js)
const bcrypt = require('bcryptjs');

// POST /auth/register - Ruta de Registro de Nuevos Usuarios
router.post('/register', async (req, res) => {
    const { nombreUsuario, email, password, passwordConfirm } = req.body;

    // Validaciones básicas
    if (!nombreUsuario || !email || !password || !passwordConfirm) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    if (password !== passwordConfirm) {
        return res.status(400).json({ message: 'Las contraseñas no coinciden.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    try {
        // Verificar si el usuario o email ya existen
        let usuarioExistente = await Usuario.findOne({ $or: [{ email: email.toLowerCase() }, { nombreUsuario: nombreUsuario }] });
        if (usuarioExistente) {
            return res.status(400).json({ message: 'El email o nombre de usuario ya está registrado.' });
        }

        // Crear una nueva instancia del modelo Usuario
        const nuevoUsuario = new Usuario({
            nombreUsuario,
            email: email.toLowerCase(), // Guardar email en minúsculas para consistencia
            password // La contraseña se hasheará automáticamente gracias al middleware 'pre-save' en el modelo
        });

        // Guardar el nuevo usuario en la base de datos
        await nuevoUsuario.save();
        
        // Respuesta exitosa
        res.status(201).json({ message: '¡Usuario registrado con éxito! Ya puedes iniciar sesión.' });

    } catch (error) {
        console.error("Error en POST /auth/register:", error);
        // Manejo de errores de validación de Mongoose
        if (error.name === 'ValidationError') {
            const mensajes = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: mensajes.join(' ') });
        }
        // Error genérico del servidor
        res.status(500).json({ message: 'Error en el servidor al registrar el usuario. Inténtalo más tarde.' });
    }
});

// POST /auth/login - Ruta de Inicio de Sesión
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'El email y la contraseña son obligatorios.' });
    }

    try {
        // Buscar al usuario por email (guardado en minúsculas)
        const usuario = await Usuario.findOne({ email: email.toLowerCase() });
        if (!usuario) {
            // Mensaje genérico para no revelar si el email existe o no
            return res.status(401).json({ message: 'Credenciales inválidas.' }); 
        }

        // Comparar la contraseña ingresada con la hasheada en la BD
        const esMatch = await usuario.compararPassword(password);
        if (!esMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // Si las credenciales son correctas, establecer la sesión
        req.session.usuarioId = usuario._id; // Guardar el ID del usuario en la sesión
        req.session.nombreUsuario = usuario.nombreUsuario; // Guardar el nombre de usuario (opcional, útil para UI)
        
        // Es buena práctica guardar la sesión explícitamente antes de enviar la respuesta
        req.session.save(err => {
            if (err) {
                console.error("Error al guardar sesión en login:", err);
                return res.status(500).json({ message: 'Error al iniciar sesión. Inténtalo más tarde.' });
            }
            // Respuesta exitosa
            res.status(200).json({ 
                message: 'Login exitoso. Redirigiendo...',
                redirectTo: '/', // Página a la que redirigir tras el login
                usuario: { // Enviar información básica del usuario al cliente (opcional)
                    id: usuario._id,
                    nombreUsuario: usuario.nombreUsuario,
                    email: usuario.email
                }
            });
        });

    } catch (error) {
        console.error("Error en POST /auth/login:", error);
        res.status(500).json({ message: 'Error en el servidor durante el login. Inténtalo más tarde.' });
    }
});

// GET /auth/logout - Ruta de Cierre de Sesión
router.get('/logout', (req, res) => {
    req.session.destroy((err) => { // Destruir la sesión
        if (err) {
            console.error("Error al destruir la sesión:", err);
            // Aunque haya un error, intentamos limpiar la cookie y redirigir
            res.clearCookie('connect.sid'); // Nombre por defecto de la cookie de sesión de express-session
            return res.status(500).json({ message: 'No se pudo cerrar sesión completamente, pero se intentó.', redirectTo: '/login.html' });
        }
        res.clearCookie('connect.sid');
        // No enviar JSON aquí si el cliente espera una redirección o maneja el logout
        // Si el cliente hace un fetch, sí enviar JSON.
        // Para un simple enlace <a> que lleva a /auth/logout, una redirección es mejor.
        // res.status(200).json({ message: 'Logout exitoso.', redirectTo: '/login.html' });
        res.redirect('/login.html'); // Redirigir al login tras cerrar sesión
    });
});


// GET /auth/status - Ruta para verificar el estado de la sesión (opcional, útil para el frontend)
router.get('/status', (req, res) => {
    if (req.session.usuarioId) {
        res.status(200).json({
            isLoggedIn: true,
            usuario: {
                id: req.session.usuarioId,
                nombreUsuario: req.session.nombreUsuario
                // No enviar el email aquí a menos que sea estrictamente necesario
            }
        });
    } else {
        res.status(200).json({ isLoggedIn: false });
    }
});

module.exports = router;