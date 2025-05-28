// FinalBase/routes/auth.js
const express = require('express');
const router = express.Router();
// Asegúrate de que la ruta a tu modelo Usuario sea correcta desde ESTE archivo
// Si auth.js está en 'FinalBase/routes/' y Usuario.js en 'FinalBase/models/', entonces '../models/Usuario' es correcto.
const Usuario = require('../models/Usuario'); 
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
            // Construir un mensaje de error más amigable a partir de los errores de validación
            let errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ message: "Error de validación.", errors });
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
            return res.status(401).json({ message: 'Credenciales inválidas.' }); 
        }

        // Comparar la contraseña ingresada con la hasheada en la BD
        const esMatch = await usuario.compararPassword(password);
        if (!esMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // Si las credenciales son correctas, establecer la sesión
        req.session.usuarioId = usuario._id; 
        req.session.nombreUsuario = usuario.nombreUsuario; 
        req.session.save(err => {
            if (err) {
                console.error("Error al guardar sesión en login:", err);
                return res.status(500).json({ message: 'Error al iniciar sesión. Inténtalo más tarde.' });
            }
            res.status(200).json({ 
                message: 'Login exitoso. Redirigiendo...',
                redirectTo: '/', 
                usuario: { 
                    id: usuario._id,
                    nombreUsuario: usuario.nombreUsuario,
                    email: usuario.email // Opcional: no enviar email si no es necesario en el frontend tras login
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
    req.session.destroy((err) => { 
        if (err) {
            console.error("Error al destruir la sesión:", err);
            res.clearCookie('connect.sid'); // Intenta limpiar la cookie de todas formas
            // Podrías enviar un error, pero para el logout, a veces es mejor solo redirigir.
            return res.status(500).json({ message: 'No se pudo cerrar sesión completamente.', redirectTo: '/login.html' });
        }
        res.clearCookie('connect.sid'); // Nombre por defecto de la cookie de express-session
        // Para el script del frontend que espera JSON, esta respuesta es mejor:
        res.status(200).json({ message: 'Logout exitoso.', redirectTo: '/login.html' });
        // Si fuera un logout por un simple enlace <a> y no fetch(), una redirección directa sería:
        // res.redirect('/login.html');
    });
});


// GET /auth/status - Ruta para verificar el estado de la sesión
router.get('/status', (req, res) => {
    // Asegúrate de que req.session.usuarioId y req.session.nombreUsuario se establezcan correctamente durante el login
    if (req.session.usuarioId && req.session.nombreUsuario) {
        res.status(200).json({
            isLoggedIn: true,
            usuario: {
                id: req.session.usuarioId,
                nombreUsuario: req.session.nombreUsuario
                // Considera qué información del usuario es seguro y necesario enviar al frontend aquí
            }
        });
    } else {
        // Es importante enviar un estado 200 OK incluso si no está logueado,
        // para que el fetch del frontend no lo trate como un error de red.
        res.status(200).json({ isLoggedIn: false });
    }
});

module.exports = router;
