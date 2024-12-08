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
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

export default connectDB;
