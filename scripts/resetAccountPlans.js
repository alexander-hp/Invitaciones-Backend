require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../src/models/Payment');
const User = require('../src/models/User');
const Event = require('../src/models/Event');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/invitaciones';
  console.log('Conectando a base de datos:', uri);
  await mongoose.connect(uri);
  console.log('Conexión exitosa.');

  // 1. Eliminar todo el historial de pagos
  const paymentRes = await Payment.deleteMany({});
  console.log(`- Historial de pagos vaciado (eliminados ${paymentRes.deletedCount} registros).`);

  // 2. Resetear el estado de suscripción de todos los usuarios
  const userRes = await User.updateMany({}, {
    subscriptionPlan: 'free',
    subscriptionStatus: 'inactive',
    stripeCustomerId: undefined,
    stripeSubscriptionId: undefined,
    subscriptionCurrentPeriodEnd: undefined
  });
  console.log(`- Suscripciones de usuarios restablecidas a Plan Gratuito (afectados ${userRes.modifiedCount} usuarios).`);

  // 3. Resetear el plan de todos los eventos
  const eventRes = await Event.updateMany({}, {
    plan: 'free',
    planActivatedAt: undefined,
    planExpiresAt: undefined
  });
  console.log(`- Planes de eventos restablecidos a Plan Gratuito (afectados ${eventRes.modifiedCount} eventos).`);

  await mongoose.disconnect();
  console.log('Base de datos desconectada y limpia.');
}

main().catch(err => {
  console.error('Error al restablecer la base de datos:', err);
  process.exit(1);
});
