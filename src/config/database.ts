import mongoose from 'mongoose';

const connectDB = async () => {
  const mongoURI =
    process.env.MONGO_URI || 'mongodb://localhost:27017/mydatabase';

  try {
    await mongoose.connect(mongoURI, 
      {
        serverSelectionTimeoutMS: 5000, // Tiempo de espera para conectar
        socketTimeoutMS: 45000, // Tiempo de espera para operaciones
        maxPoolSize: 10, // Tamaño del pool de conexiones
        minPoolSize: 0, // Cierra las conexiones cuando no hay actividad
        // autoReconnect: true, // Reconexión automática
        maxIdleTimeMS: 60000, // Tiempo de espera para cerrar las conexiones

      }
    );
    console.log("Conexión a MongoDB establecida.");
    
    mongoose.connection.on("disconnected", () => {
      console.log("Conexión a MongoDB perdida.");
    });
    
    mongoose.connection.on("reconnected", () => {
      console.log("Reconexión exitosa a MongoDB.");
    });
    
    mongoose.connection.on("error", (err) => {
      console.error("Error de conexión a MongoDB:", err.message);
    });

    mongoose.connection.on("connected", () => {
      console.log("Reconectado a MongoDB");
  });

  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

let idleTimeout;

function resetIdleTimeout() {
  clearTimeout(idleTimeout);
  idleTimeout = setTimeout(async () => {
      console.log("No hay actividad, cerrando la conexión...");
      await mongoose.connection.close();
      console.log("Conexión cerrada por inactividad.");
  }, 30000); // 30 segundos de inactividad
}

export const ensureDatabaseConnection = async (req, res, next) => {
  if (!mongoose.connection.readyState) {
    await connectDB();
  }

  resetIdleTimeout(); // Reinicia el temporizador de inactividad
  next();
}

export default connectDB;
