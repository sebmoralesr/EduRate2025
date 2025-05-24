// ================================
// FinalBase/app.js con Autenticación
// ================================

require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- Modelos ---
// Asegúrate que las rutas a tus modelos son correctas desde la perspectiva de app.js
const Docente = require('./FinalBase/models/Docente');
const Materia = require('./FinalBase/models/Materia');
const Valoracion = require('./FinalBase/models/Valoracion');
const Usuario = require('./FinalBase/models/Usuario'); // << IMPORTANTE: Modelo de Usuario

const app = express();
const PORT = process.env.PORT || 3000;
// Es una buena práctica usar variables de entorno para la URI de MongoDB y el secreto de sesión
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Migracion';
const SESSION_SECRET = process.env.SESSION_SECRET || 'este_es_un_secreto_temporal_cambiame_por_algo_seguro';

// --- Conexión a MongoDB ---
mongoose.connect(MONGODB_URI)
    .then(() => console.log("✅ Conectado a MongoDB"))
    .catch((err) => console.error("❌ Error al conectar a MongoDB:", err));

// --- Middlewares ---
// Servir archivos estáticos (CSS, JS del cliente, imágenes) desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));
// Parsear cuerpos de petición JSON
app.use(express.json());
// Parsear cuerpos de petición URL-encoded (formularios HTML tradicionales)
app.use(express.urlencoded({ extended: true }));

// Configuración de express-session
app.use(session({
    secret: SESSION_SECRET,
    resave: false, // No guardar la sesión si no se modificó
    saveUninitialized: false, // No crear sesión hasta que algo se guarde
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        collectionName: 'app_sessions', // Nombre para la colección de sesiones en MongoDB
        ttl: 14 * 24 * 60 * 60 // Tiempo de vida de la sesión (14 días en segundos)
    }),
    cookie: {
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 días en milisegundos
        httpOnly: true, // Previene acceso a la cookie desde JS en el cliente (seguridad)
        secure: process.env.NODE_ENV === 'production', // Usar cookies seguras (HTTPS) solo en producción
        sameSite: 'lax' // Protección CSRF
    }
}));

// Middleware para hacer accesible información del usuario en todas las vistas (si usaras un motor de plantillas)
// y para lógica general de sesión.
app.use((req, res, next) => {
    // res.locals es un objeto que pasa datos a las plantillas (si usas EJS, Pug, etc.)
    // Aquí lo usamos para que esté disponible en cualquier parte de la petición si es necesario.
    if (req.session.usuarioId) {
        res.locals.usuarioAutenticado = true;
        res.locals.nombreUsuario = req.session.nombreUsuario;
    } else {
        res.locals.usuarioAutenticado = false;
    }
    // console.log('Sesión actual:', req.session); // Para depuración de sesiones
    next();
});


// --- Rutas HTML ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/personas', (req, res) => res.sendFile(path.join(__dirname, 'views', 'personas.html')));
app.get('/logros', (req, res) => res.sendFile(path.join(__dirname, 'views', 'logros.html')));
app.get('/amigos', (req, res) => res.sendFile(path.join(__dirname, 'views', 'amigos.html')));
app.get('/nosotros', (req, res) => res.sendFile(path.join(__dirname, 'views', 'Nosotros.html'))); // Asumiendo que el archivo se llama Nosotros.html


// Nuevas rutas para servir los HTML de login y registro
app.get('/login.html', (req, res) => {
    if (req.session.usuarioId) { // Si el usuario ya está logueado, redirigir al inicio
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/registro.html', (req, res) => {
     if (req.session.usuarioId) { // Si el usuario ya está logueado, redirigir al inicio
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'views', 'registro.html'));
});


// --- Rutas de Autenticación ---
// Todas las rutas definidas en auth.js estarán prefijadas con /auth
const authRoutes = require('./FinalBase/routes/auth.js');
app.use('/auth', authRoutes);


// --- Rutas API (TUS RUTAS EXISTENTES) ---
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// COPIA Y PEGA TUS RUTAS API EXISTENTES AQUÍ (las de /api/data, /promedio, etc.)
// Ejemplo de cómo se vería una:
/*
app.get('/api/data', async (req, res) => {
    try {
        // Tu lógica actual...
        const docentes = await Valoracion.aggregate([...]).exec();
        res.json({ labels: ..., valuesMateria: ..., valuesProfesor: ... });
    } catch (err) {
        console.error("Error en /api/data:", err);
        res.status(500).json({message: 'Error al obtener datos para gráfica de barras'});
    }
});
*/
// Asegúrate de adaptar el manejo de errores para que devuelva JSON como en el ejemplo.

app.get('/api/data', async (req, res) => {
    try {
        const docentes = await Valoracion.aggregate([
            {
                $lookup: {
                    from: 'Docente', 
                    localField: 'id_maestro',
                    foreignField: 'id_maestro',
                    as: 'docenteInfo' 
                }
            },
            { $unwind: "$docenteInfo" },
            {
                $group: {
                    _id: {
                        nombre: "$docenteInfo.Nombre_profesor",
                        apellido: "$docenteInfo.Apellido_profesor"
                    },
                    Promedio_Puntuacion_Materia: { $avg: "$Puntuacion_materia" },
                    Promedio_Puntuacion_Profesor: { $avg: "$Puntuacion_profesor" }
                }
            },
            { $sort: { "_id.nombre": 1, "_id.apellido": 1 } } // Añadido para orden consistente
        ]).exec(); 

        res.json({
            labels: docentes.map(d => `${d._id.nombre} ${d._id.apellido}`),
            valuesMateria: docentes.map(d => d.Promedio_Puntuacion_Materia),
            valuesProfesor: docentes.map(d => d.Promedio_Puntuacion_Profesor)
        });
    } catch (err) {
        console.error("Error en /api/data:", err);
        res.status(500).json({message: 'Error al obtener datos para gráfica de barras'});
    }
});

app.get('/api/pie-data', async (req, res) => {
    try {
        const materias = await Valoracion.aggregate([
            {
                $lookup: {
                    from: 'Materia', 
                    localField: 'id_materia',
                    foreignField: 'id_materia',
                    as: 'materiaInfo'
                }
            },
            { $unwind: "$materiaInfo" },
            {
                $group: {
                    _id: "$materiaInfo.Materia",
                    Frecuencia_Evaluaciones: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } } // Añadido para orden consistente
        ]).exec();

        res.json({
            labels: materias.map(m => m._id),
            values: materias.map(m => m.Frecuencia_Evaluaciones)
        });
    } catch (err) {
        console.error("Error en /api/pie-data:", err);
        res.status(500).json({message: 'Error al obtener datos para la gráfica de torta'});
    }
});

app.get('/api/scatter-data', async (req, res) => {
    try {
        const datos = await Valoracion.aggregate([
            {
                $lookup: {
                    from: 'Docente', 
                    localField: 'id_maestro',
                    foreignField: 'id_maestro',
                    as: 'docenteInfo'
                }
            },
            { $unwind: "$docenteInfo" },
            {
                $group: {
                    _id: {
                        nombre: "$docenteInfo.Nombre_profesor",
                        apellido: "$docenteInfo.Apellido_profesor"
                    },
                    // Asegúrate que el campo 'Calidad_profesor' existe en tu modelo 'Valoracion'
                    // Si no existe, esta agregación fallará o devolverá null.
                    Promedio_Calidad: { $avg: "$Calidad_profesor" } 
                }
            },
            // { $match: { Promedio_Calidad: { $gt: 4 } } } // Descomentar si 'Calidad_profesor' existe y es numérico
            { $sort: { "_id.nombre": 1, "_id.apellido": 1 } }
        ]).exec();

        res.json({ scatterData: datos.map(d => ({ x: `${d._id.nombre} ${d._id.apellido}`, y: d.Promedio_Calidad })) });
    } catch (err) {
        console.error("Error en /api/scatter-data:", err);
        res.status(500).json({message: 'Error al obtener datos para la gráfica de dispersión'});
    }
});

app.get('/promedio', async (req, res) => {
    const { Materia: materiaNombre, Nombre_profesor, Apellido_profesor } = req.query;

    if (!materiaNombre || !Nombre_profesor || !Apellido_profesor) {
        return res.status(400).json({message: "Faltan parámetros obligatorios: Materia, Nombre_profesor, Apellido_profesor."});
    }

    try {
        const docente = await Docente.findOne({ Nombre_profesor, Apellido_profesor }).lean();
        const materia = await Materia.findOne({ Materia: materiaNombre }).lean();

        if (!docente) return res.status(404).json({message: `Docente no encontrado: ${Nombre_profesor} ${Apellido_profesor}`});
        if (!materia) return res.status(404).json({message: `Materia no encontrada: ${materiaNombre}`});

        const idMaestroNum = Number(docente.id_maestro);
        const idMateriaNum = Number(materia.id_materia);

        if (isNaN(idMaestroNum) || isNaN(idMateriaNum)) {
            console.error(`IDs inválidos: id_maestro='${docente.id_maestro}', id_materia='${materia.id_materia}'`);
            return res.status(500).json({message: "Error interno: IDs de maestro o materia no son numéricos."});
        }

        const promedio = await Valoracion.aggregate([
            { $match: { id_maestro: idMaestroNum, id_materia: idMateriaNum } },
            { $group: { _id: null, Puntacion_promedio: { $avg: "$Puntuacion_profesor" } } } 
        ]).exec();

        if (!promedio.length || promedio[0].Puntacion_promedio === null) {
            return res.status(404).json({message: "No se encontraron valoraciones para calcular el promedio."});
        }
        res.json(promedio[0]);
    } catch (err) {
        console.error("Error en /promedio:", err);
        res.status(500).json({message: "Error al calcular promedio"});
    }
});

app.get('/api/dynamic-data', async (req, res) => {
    try {
        const datos = await Valoracion.aggregate([
            {
                $lookup: {
                    from: 'Docente', 
                    localField: 'id_maestro',
                    foreignField: 'id_maestro',
                    as: 'docenteInfo'
                }
            },
            { $unwind: "$docenteInfo" },
            {
                $group: {
                    _id: {
                        Ano: "$Ano", 
                        Nombre_profesor: "$docenteInfo.Nombre_profesor",
                        Apellido_profesor: "$docenteInfo.Apellido_profesor"
                    },
                    Promedio_Puntuacion_Profesor: { $avg: "$Puntuacion_profesor" } 
                }
            },
            { $sort: { "_id.Nombre_profesor": 1, "_id.Apellido_profesor": 1, "_id.Ano": 1 } }
        ]).exec();

        res.json(datos);
    } catch (err) {
        console.error("Error en /api/dynamic-data:", err);
        res.status(500).json({message: "Error al obtener datos dinámicos"});
    }
});

app.get('/docentes', async (req, res) => {
    try {
        const datos = await Valoracion.aggregate([
            { $lookup: { from: 'Docente', localField: 'id_maestro', foreignField: 'id_maestro', as: 'docenteInfo' } },
            { $unwind: "$docenteInfo" },
            { $lookup: { from: 'Materia', localField: 'id_materia', foreignField: 'id_materia', as: 'materiaInfo' } },
            { $unwind: "$materiaInfo" },
            {
                $group: {
                    _id: { 
                        id_maestro: "$docenteInfo.id_maestro", 
                        Nombre_profesor: "$docenteInfo.Nombre_profesor",
                        Apellido_profesor: "$docenteInfo.Apellido_profesor",
                        id_materia: "$materiaInfo.id_materia",
                        Materia: "$materiaInfo.Materia"
                    }
                }
            },
            {
                $project: { 
                    _id: 0, 
                    Nombre_profesor: "$_id.Nombre_profesor",
                    Apellido_profesor: "$_id.Apellido_profesor",
                    Materia: "$_id.Materia"
                }
            },
            { $sort: { "Nombre_profesor": 1, "Apellido_profesor": 1, "Materia": 1 } }
        ]).exec();
        res.json(datos);
    } catch (err) {
        console.error("Error en /docentes:", err);
        res.status(500).json({message: "Error al obtener docentes y materias valoradas"});
    }
});

app.get('/detalles', async (req, res) => {
    const { Materia: materiaNombre, Nombre_profesor, Apellido_profesor } = req.query;

    if (!materiaNombre || !Nombre_profesor || !Apellido_profesor) {
        return res.status(400).json({message: "Faltan parámetros obligatorios: Materia, Nombre_profesor, Apellido_profesor."});
    }

    try {
        const docente = await Docente.findOne({ Nombre_profesor, Apellido_profesor }).lean();
        const materia = await Materia.findOne({ Materia: materiaNombre }).lean();

        if (!docente) return res.status(404).json({message: `Docente no encontrado: ${Nombre_profesor} ${Apellido_profesor}`});
        if (!materia) return res.status(404).json({message: `Materia no encontrada: ${materiaNombre}`});

        const idMaestroParaBuscar = Number(docente.id_maestro);
        const idMateriaParaBuscar = Number(materia.id_materia);

        if (isNaN(idMaestroParaBuscar) || isNaN(idMateriaParaBuscar)) {
             console.error(`IDs inválidos al buscar detalles: id_maestro='${docente.id_maestro}', id_materia='${materia.id_materia}'`);
             return res.status(500).json({message: "Error interno: ID de maestro o materia inválido."});
        }

        const detalles = await Valoracion.find(
            { id_maestro: idMaestroParaBuscar, id_materia: idMateriaParaBuscar },
            // Proyección explícita de campos
            { _id: 0, Puntuacion_profesor: 1, Reseña: 1, Ano: 1, Nota_materia: 1 } 
        ).lean();

        if (!detalles || detalles.length === 0) {
            // Es válido devolver un array vacío si no hay detalles.
            return res.json([]); 
        }
        
        const resultadoParaFrontend = detalles.map(d => ({
            // Lógica mejorada para determinar 'Nota'
            Nota: d.Nota_materia !== undefined && d.Nota_materia !== null ? d.Nota_materia : 
                  (d.Puntuacion_profesor !== undefined && d.Puntuacion_profesor !== null ? d.Puntuacion_profesor : 'N/A'),
            Reseña: d.Reseña !== null && d.Reseña !== undefined ? d.Reseña : "No disponible",
            Ano: d.Ano !== undefined && d.Ano !== null ? d.Ano : 'N/A'
        }));
        
        res.json(resultadoParaFrontend);

    } catch (err) {
        console.error("[DETALLES] ERROR:", err);
        res.status(500).json({message: "Error al obtener detalles"});
    }
});
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲


// --- Middleware de Ruta no Encontrada (404) ---
// Debe ir después de todas las rutas definidas
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'views', '404.html')); // Necesitarás crear un 404.html
});

// --- Middleware de Manejo de Errores General ---
// Debe ser el último middleware
app.use((err, req, res, next) => {
    console.error("Ha ocurrido un error no controlado:", err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'Error interno del servidor. Por favor, inténtalo más tarde.'
    });
});

// --- Iniciar Servidor ---
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));

// // ================================
// // ✅ app.js con depuración para campo Reseña
// // ================================
// const express = require('express');
// const path = require('path');
// const mongoose = require('mongoose');

// // Asegúrate de que las rutas a tus modelos son correctas
// // y que los modelos están definidos como se discutió (con tipos Number para IDs y nombres de colección)
// const Docente = require('./FinalBase/models/Docente');
// const Materia = require('./FinalBase/models/Materia');
// const Valoracion = require('./FinalBase/models/Valoracion');

// const app = express();
// const PORT = 3000;

// mongoose.connect('mongodb://localhost:27017/Migracion')
//     .then(() => console.log("✅ Conectado a MongoDB"))
//     .catch((err) => console.error("❌ Error al conectar a MongoDB:", err));

// app.use(express.static(path.join(__dirname, 'public')));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // --- Rutas HTML ---
// app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
// app.get('/personas', (req, res) => res.sendFile(path.join(__dirname, 'views', 'personas.html')));
// app.get('/logros', (req, res) => res.sendFile(path.join(__dirname, 'views', 'logros.html')));
// app.get('/amigos', (req, res) => res.sendFile(path.join(__dirname, 'views', 'amigos.html')));

// // --- Rutas API ---

// app.get('/api/data', async (req, res) => {
//     try {
//         const docentes = await Valoracion.aggregate([
//             {
//                 $lookup: {
//                     from: 'Docente', // Nombre exacto de la colección en MongoDB
//                     localField: 'id_maestro',
//                     foreignField: 'id_maestro',
//                     as: 'docenteInfo' // Cambiado a docenteInfo para evitar confusión con el modelo Docente
//                 }
//             },
//             { $unwind: "$docenteInfo" },
//             {
//                 $group: {
//                     _id: {
//                         nombre: "$docenteInfo.Nombre_profesor",
//                         apellido: "$docenteInfo.Apellido_profesor"
//                     },
//                     Promedio_Puntuacion_Materia: { $avg: "$Puntuacion_materia" },
//                     Promedio_Puntuacion_Profesor: { $avg: "$Puntuacion_profesor" }
//                 }
//             }
//         ]).exec(); // .exec() es buena práctica con aggregate

//         res.json({
//             labels: docentes.map(d => `${d._id.nombre} ${d._id.apellido}`),
//             valuesMateria: docentes.map(d => d.Promedio_Puntuacion_Materia),
//             valuesProfesor: docentes.map(d => d.Promedio_Puntuacion_Profesor)
//         });
//     } catch (err) {
//         console.error("Error en /api/data:", err);
//         res.status(500).send('Error al obtener datos para gráfica de barras');
//     }
// });

// app.get('/api/pie-data', async (req, res) => {
//     try {
//         const materias = await Valoracion.aggregate([
//             {
//                 $lookup: {
//                     from: 'Materia', // Nombre exacto de la colección
//                     localField: 'id_materia',
//                     foreignField: 'id_materia',
//                     as: 'materiaInfo'
//                 }
//             },
//             { $unwind: "$materiaInfo" },
//             {
//                 $group: {
//                     _id: "$materiaInfo.Materia",
//                     Frecuencia_Evaluaciones: { $sum: 1 }
//                 }
//             }
//         ]).exec();

//         res.json({
//             labels: materias.map(m => m._id),
//             values: materias.map(m => m.Frecuencia_Evaluaciones)
//         });
//     } catch (err) {
//         console.error("Error en /api/pie-data:", err);
//         res.status(500).send('Error al obtener datos para la gráfica de torta');
//     }
// });

// app.get('/api/scatter-data', async (req, res) => {
//     try {
//         const datos = await Valoracion.aggregate([
//             {
//                 $lookup: {
//                     from: 'Docente', // Nombre exacto de la colección
//                     localField: 'id_maestro',
//                     foreignField: 'id_maestro',
//                     as: 'docenteInfo'
//                 }
//             },
//             { $unwind: "$docenteInfo" },
//             {
//                 $group: {
//                     _id: {
//                         nombre: "$docenteInfo.Nombre_profesor",
//                         apellido: "$docenteInfo.Apellido_profesor"
//                     },
//                     Promedio_Calidad: { $avg: "$Calidad_profesor" }
//                 }
//             },
//             { $match: { Promedio_Calidad: { $gt: 4 } } }
//         ]).exec();

//         res.json({ scatterData: datos.map(d => ({ x: `${d._id.nombre} ${d._id.apellido}`, y: d.Promedio_Calidad })) });
//     } catch (err) {
//         console.error("Error en /api/scatter-data:", err);
//         res.status(500).send('Error al obtener datos para la gráfica de dispersión');
//     }
// });

// app.get('/promedio', async (req, res) => {
//     const { Materia: materiaNombre, Nombre_profesor, Apellido_profesor } = req.query;

//     if (!materiaNombre || !Nombre_profesor || !Apellido_profesor) {
//         return res.status(400).send("Faltan parámetros obligatorios: Materia, Nombre_profesor, Apellido_profesor.");
//     }

//     try {
//         const docente = await Docente.findOne({ Nombre_profesor, Apellido_profesor }).lean();
//         const materia = await Materia.findOne({ Materia: materiaNombre }).lean();

//         if (!docente) return res.status(404).send(`Docente no encontrado: ${Nombre_profesor} ${Apellido_profesor}`);
//         if (!materia) return res.status(404).send(`Materia no encontrada: ${materiaNombre}`);

//         const promedio = await Valoracion.aggregate([
//             { $match: { id_maestro: Number(docente.id_maestro), id_materia: Number(materia.id_materia) } },
//             { $group: { _id: null, Puntacion_promedio: { $avg: "$Puntuacion_profesor" } } }
//         ]).exec();

//         if (!promedio.length || promedio[0].Puntacion_promedio === null) {
//             return res.status(404).send("No se encontraron valoraciones para calcular el promedio.");
//         }
//         res.json(promedio[0]);
//     } catch (err) {
//         console.error("Error en /promedio:", err);
//         res.status(500).send("Error al calcular promedio");
//     }
// });

// app.get('/api/dynamic-data', async (req, res) => {
//     try {
//         const datos = await Valoracion.aggregate([
//             {
//                 $lookup: {
//                     from: 'Docente', // Nombre exacto de la colección
//                     localField: 'id_maestro',
//                     foreignField: 'id_maestro',
//                     as: 'docenteInfo'
//                 }
//             },
//             { $unwind: "$docenteInfo" },
//             {
//                 $group: {
//                     _id: {
//                         Ano: "$Ano",
//                         Nombre_profesor: "$docenteInfo.Nombre_profesor",
//                         Apellido_profesor: "$docenteInfo.Apellido_profesor"
//                     },
//                     Promedio_Puntuacion_Profesor: { $avg: "$Puntuacion_profesor" }
//                 }
//             },
//             { $sort: { "_id.Nombre_profesor": 1, "_id.Apellido_profesor": 1, "_id.Ano": 1 } }
//         ]).exec();

//         res.json(datos);
//     } catch (err) {
//         console.error("Error en /api/dynamic-data:", err);
//         res.status(500).send("Error al obtener datos dinámicos");
//     }
// });

// app.get('/docentes', async (req, res) => {
//     try {
//         // Esta consulta busca combinaciones únicas de profesor y materia que han sido valoradas.
//         const datos = await Valoracion.aggregate([
//             {
//                 $lookup: {
//                     from: 'Docente', // Nombre exacto de la colección
//                     localField: 'id_maestro',
//                     foreignField: 'id_maestro',
//                     as: 'docenteInfo'
//                 }
//             },
//             { $unwind: "$docenteInfo" },
//             {
//                 $lookup: {
//                     from: 'Materia', // Nombre exacto de la colección
//                     localField: 'id_materia',
//                     foreignField: 'id_materia',
//                     as: 'materiaInfo'
//                 }
//             },
//             { $unwind: "$materiaInfo" },
//             {
//                 $group: {
//                     _id: { // Agrupamos por los campos que queremos que sean únicos
//                         id_maestro: "$docenteInfo.id_maestro", // Incluir IDs para asegurar unicidad si hay homónimos
//                         Nombre_profesor: "$docenteInfo.Nombre_profesor",
//                         Apellido_profesor: "$docenteInfo.Apellido_profesor",
//                         id_materia: "$materiaInfo.id_materia",
//                         Materia: "$materiaInfo.Materia"
//                     }
//                 }
//             },
//             {
//                 $project: { // Proyectamos para darle el formato deseado
//                     _id: 0, // Excluimos el _id generado por $group si no lo necesitamos así
//                     Nombre_profesor: "$_id.Nombre_profesor",
//                     Apellido_profesor: "$_id.Apellido_profesor",
//                     Materia: "$_id.Materia"
//                     // Puedes añadir id_maestro e id_materia si los necesitas en el frontend para futuras búsquedas
//                 }
//             },
//             { $sort: { "Nombre_profesor": 1, "Apellido_profesor": 1, "Materia": 1 } }
//         ]).exec();

//         res.json(datos); // Ya está en el formato deseado por $project
//     } catch (err) {
//         console.error("Error en /docentes:", err);
//         res.status(500).send("Error al obtener docentes y materias valoradas");
//     }
// });

// // Endpoint /detalles con depuración mejorada
// app.get('/detalles', async (req, res) => {
//     const { Materia: materiaNombre, Nombre_profesor, Apellido_profesor } = req.query;

//     if (!materiaNombre || !Nombre_profesor || !Apellido_profesor) {
//         return res.status(400).send("Faltan parámetros obligatorios: Materia, Nombre_profesor, Apellido_profesor.");
//     }

//     try {
//         console.log(`[DETALLES] Iniciando búsqueda para Docente: ${Nombre_profesor} ${Apellido_profesor}, Materia: ${materiaNombre}`);

//         // Buscamos al docente
//         console.log(`[DETALLES] Buscando en colección Docente: { Nombre_profesor: "${Nombre_profesor}", Apellido_profesor: "${Apellido_profesor}" }`);
//         const docente = await Docente.findOne({ Nombre_profesor, Apellido_profesor }).lean();

//         // Buscamos la materia
//         console.log(`[DETALLES] Buscando en colección Materia: { Materia: "${materiaNombre}" }`);
//         const materia = await Materia.findOne({ Materia: materiaNombre }).lean();

//         if (!docente) {
//             console.log(`[DETALLES] DOCENTE NO ENCONTRADO: ${Nombre_profesor} ${Apellido_profesor}`);
//             return res.status(404).send(`Docente no encontrado: ${Nombre_profesor} ${Apellido_profesor}`);
//         }
//         if (!materia) {
//             console.log(`[DETALLES] MATERIA NO ENCONTRADA: ${materiaNombre}`);
//             return res.status(404).send(`Materia no encontrada: ${materiaNombre}`);
//         }

//         console.log("[DETALLES] Docente encontrado:", JSON.stringify(docente, null, 2));
//         console.log("[DETALLES] Materia encontrada:", JSON.stringify(materia, null, 2));

//         // Es crucial que id_maestro e id_materia sean del tipo correcto (Number)
//         const idMaestroParaBuscar = Number(docente.id_maestro);
//         const idMateriaParaBuscar = Number(materia.id_materia);

//         if (isNaN(idMaestroParaBuscar)) {
//             console.error(`[DETALLES] ERROR: docente.id_maestro ("${docente.id_maestro}") no es un número válido.`);
//             return res.status(500).send("Error interno: ID de maestro inválido.");
//         }
//         if (isNaN(idMateriaParaBuscar)) {
//             console.error(`[DETALLES] ERROR: materia.id_materia ("${materia.id_materia}") no es un número válido.`);
//             return res.status(500).send("Error interno: ID de materia inválido.");
//         }

//         console.log(`[DETALLES] Buscando en colección Valoracion con: { id_maestro: ${idMaestroParaBuscar} (tipo: ${typeof idMaestroParaBuscar}), id_materia: ${idMateriaParaBuscar} (tipo: ${typeof idMateriaParaBuscar}) }`);

//         const detalles = await Valoracion.find(
//             {
//                 id_maestro: idMaestroParaBuscar,
//                 id_materia: idMateriaParaBuscar
//             },
//             // Proyección: seleccionamos los campos que queremos devolver
//             // _id se incluye por defecto, lo excluimos si no lo necesitamos.
//             // Asegúrate que 'Nota_materia' es el campo correcto para 'Nota' en tu UI.
//             { _id: 0, Puntuacion_profesor: 1, "Reseña": 1, Ano: 1, Nota_materia: 1 }
//         ).lean(); // .lean() para obtener objetos JS puros

//         if (!detalles || detalles.length === 0) {
//             console.log(`[DETALLES] NO SE ENCONTRARON VALORACIONES para id_maestro: ${idMaestroParaBuscar}, id_materia: ${idMateriaParaBuscar}`);
//             // Devolver un array vacío es una opción válida si el frontend lo espera así.
//             // O un 404 si se considera que no encontrar valoraciones es un "no encontrado".
//             // Por coherencia con la imagen, si no hay datos, el frontend muestra "No disponible",
//             // así que un array vacío o un objeto con valores por defecto podría ser lo que el frontend espera.
//             // Para este ejemplo, si no hay detalles, enviamos un array vacío.
//             return res.json([]); // O res.status(404).send("No se encontraron valoraciones para este docente y materia.");
//         }

//         console.log(`[DETALLES] VALORACIONES ENCONTRADAS (${detalles.length}):`);
//         detalles.forEach((detalle, index) => {
//             console.log(`  [Detalle ${index + 1}]:`, JSON.stringify(detalle, null, 2));
//             console.log(`    Reseña: Tipo = ${typeof detalle.Reseña}, Valor = "${detalle.Reseña}"`);
//             console.log(`    Nota_materia: Tipo = ${typeof detalle.Nota_materia}, Valor = ${detalle.Nota_materia}`); // Asumiendo que "Nota" en tu UI es Nota_materia
//             console.log(`    Ano: Tipo = ${typeof detalle.Ano}, Valor = ${detalle.Ano}`);
//         });

//         // Transformamos los datos para que coincidan con lo que el frontend podría esperar (Nota, Reseña, Ano)
//         // Basado en la imagen, parece que se espera un objeto por cada valoración.
//         const resultadoParaFrontend = detalles.map(d => ({
//             Nota: d.Nota_materia !== undefined ? d.Nota_materia : (d.Puntuacion_profesor !== undefined ? d.Puntuacion_profesor : 'N/A'), // Lógica para determinar qué campo es "Nota"
//             Reseña: d.Reseña !== null && d.Reseña !== undefined ? d.Reseña : "No disponible", // Manejo explícito de null/undefined para Reseña
//             Ano: d.Ano !== undefined ? d.Ano : 'N/A'
//         }));
        
//         console.log("[DETALLES] Enviando al frontend:", JSON.stringify(resultadoParaFrontend, null, 2));
//         res.json(resultadoParaFrontend);

//     } catch (err) {
//         console.error("[DETALLES] ERROR GENERAL EN EL BLOQUE TRY/CATCH:", err);
//         res.status(500).send("Error al obtener detalles");
//     }
// });


// app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));

