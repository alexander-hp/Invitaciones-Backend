require('dotenv').config();

const { connectDatabase } = require('../src/config/database');
const User = require('../src/models/User');

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.ADMIN_DEFAULT_EMAIL || 'admin@kyndrasoft.com').toLowerCase().trim();
  const password = args[1] || process.env.ADMIN_DEFAULT_PASSWORD || 'Admin123456*';
  const name = args[2] || 'Administrador KyndraSoft';

  if (!email || !password) {
    console.error('Uso: node scripts/adminUser.js [email] [password] [nombre]');
    process.exit(1);
  }

  console.log(`[adminUser] Conectando a la base de datos...`);
  await connectDatabase();

  let user = await User.findOne({ email });

  if (user) {
    console.log(`[adminUser] Usuario existente encontrado: ${user.email} (Rol anterior: ${user.role})`);
    user.name = name || user.name;
    user.role = 'admin';
    user.accountType = 'planner';
    user.plan = 'organizer';
    if (password) {
      user.passwordHash = await User.hashPassword(password);
    }
    await user.save();
    console.log(`[adminUser] ✅ Usuario actualizado exitosamente con rol 'admin'.`);
  } else {
    console.log(`[adminUser] Creando nuevo usuario administrador: ${email}`);
    const passwordHash = await User.hashPassword(password);
    user = await User.create({
      name,
      email,
      passwordHash,
      role: 'admin',
      accountType: 'planner',
      plan: 'organizer',
      subscriptionStatus: 'active'
    });
    console.log(`[adminUser] ✅ Usuario administrador creado exitosamente.`);
  }

  console.log('────────────────────────────────────────────────────────────');
  console.log(`📋 Credenciales del Administrador:`);
  console.log(`   Email:    ${user.email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Nombre:   ${user.name}`);
  console.log(`   Rol:      ${user.role}`);
  console.log(`   ID:       ${user._id}`);
  console.log('────────────────────────────────────────────────────────────');

  process.exit(0);
}

main().catch((err) => {
  console.error('[adminUser] ❌ Error:', err.message);
  process.exit(1);
});
