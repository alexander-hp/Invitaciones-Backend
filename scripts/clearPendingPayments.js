require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../src/models/Payment');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/invitaciones';
  console.log('Conectando a base de datos:', uri);
  await mongoose.connect(uri);
  console.log('Conexión exitosa.');

  const result = await Payment.deleteMany({ status: 'pending' });
  console.log(`Se eliminaron ${result.deletedCount} pagos pendientes de la base de datos.`);

  await mongoose.disconnect();
  console.log('Base de datos desconectada.');
}

main().catch(err => {
  console.error('Error al limpiar pagos:', err);
  process.exit(1);
});
