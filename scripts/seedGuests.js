require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../src/models/Event');
const Guest = require('../src/models/Guest');

async function main() {
  const args = process.argv.slice(2);
  const eventId = args[0];
  const count = parseInt(args[1] || '50', 10);

  if (!eventId) {
    console.error('Error: Debes proporcionar el ID del Evento.');
    console.error('Uso: node scripts/seedGuests.js <EVENT_ID> [CANTIDAD]');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/invitaciones';
  console.log('Conectando a base de datos:', uri);
  await mongoose.connect(uri);
  console.log('Conexión exitosa.');

  // Buscar el evento para obtener el dueño (owner)
  const event = await Event.findById(eventId);
  if (!event) {
    console.error(`Error: Evento con ID ${eventId} no encontrado.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Generando ${count} invitados para el evento "${event.title}"...`);
  const owner = event.owner;

  const names = [
    'Sofía García', 'Alejandro Martínez', 'Valeria Rodríguez', 'Mateo López', 
    'Camila González', 'Santiago Pérez', 'Isabella Sánchez', 'Leonardo Ramírez', 
    'Mariana Flores', 'Diego Gómez', 'Lucía Torres', 'Daniel Díaz', 'Gabriela Cruz', 
    'Sebastián Reyes', 'Natalia Morales', 'Andrés Ortiz', 'Andrea Ramos', 'Nicolás Ruiz', 
    'Ximena Mendoza', 'Samuel Castillo', 'Fernanda Soto', 'Joaquín Castro', 'Victoria Muñoz', 
    'Felipe Delgado', 'Daniela Alvarado', 'Emilio Herrera', 'Regina Peña', 'Mauricio Silva'
  ];

  const groups = ['Familia Novia', 'Familia Novio', 'Amigos Universidad', 'Trabajo', 'Vecinos', 'Otros'];
  const relationshipLabels = ['Amigo', 'Primo', 'Tío', 'Hermano', 'Colega', 'Cuñado'];

  const guestsToInsert = [];
  const runId = Date.now().toString().slice(-4);

  for (let i = 1; i <= count; i++) {
    const randomName = names[Math.floor(Math.random() * names.length)];
    const name = `${randomName} ${i}`;
    const email = `invitado_${runId}_${i}@example.com`;
    const phone = `+52${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const group = groups[Math.floor(Math.random() * groups.length)];
    const relationshipLabel = relationshipLabels[Math.floor(Math.random() * relationshipLabels.length)];
    const status = Math.random() > 0.4 ? 'confirmed' : (Math.random() > 0.5 ? 'declined' : 'pending');
    
    guestsToInsert.push({
      owner,
      event: event._id,
      name,
      email,
      phone,
      group,
      relationshipLabel,
      status,
      allowedCompanions: Math.floor(Math.random() * 4),
      companions: []
    });
  }

  const result = await Guest.insertMany(guestsToInsert);
  console.log(`¡Éxito! Se insertaron ${result.length} invitados correctamente.`);

  await mongoose.disconnect();
  console.log('Base de datos desconectada.');
}

main().catch(err => {
  console.error('Error al insertar invitados:', err);
  process.exit(1);
});
