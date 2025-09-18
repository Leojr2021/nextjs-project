// import bcrypt from 'bcrypt';
// import postgres from 'postgres';
// import { invoices, customers, revenue, users } from '../lib/placeholder-data';

// const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// async function seedUsers() {
//   await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
//   await sql`
//     CREATE TABLE IF NOT EXISTS users (
//       id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
//       name VARCHAR(255) NOT NULL,
//       email TEXT NOT NULL UNIQUE,
//       password TEXT NOT NULL
//     );
//   `;

//   const insertedUsers = await Promise.all(
//     users.map(async (user) => {
//       const hashedPassword = await bcrypt.hash(user.password, 10);
//       return sql`
//         INSERT INTO users (id, name, email, password)
//         VALUES (${user.id}, ${user.name}, ${user.email}, ${hashedPassword})
//         ON CONFLICT (id) DO NOTHING;
//       `;
//     }),
//   );

//   return insertedUsers;
// }

// async function seedInvoices() {
//   await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

//   await sql`
//     CREATE TABLE IF NOT EXISTS invoices (
//       id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
//       customer_id UUID NOT NULL,
//       amount INT NOT NULL,
//       status VARCHAR(255) NOT NULL,
//       date DATE NOT NULL
//     );
//   `;

//   const insertedInvoices = await Promise.all(
//     invoices.map(
//       (invoice) => sql`
//         INSERT INTO invoices (customer_id, amount, status, date)
//         VALUES (${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date})
//         ON CONFLICT (id) DO NOTHING;
//       `,
//     ),
//   );

//   return insertedInvoices;
// }

// async function seedCustomers() {
//   await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

//   await sql`
//     CREATE TABLE IF NOT EXISTS customers (
//       id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
//       name VARCHAR(255) NOT NULL,
//       email VARCHAR(255) NOT NULL,
//       image_url VARCHAR(255) NOT NULL
//     );
//   `;

//   const insertedCustomers = await Promise.all(
//     customers.map(
//       (customer) => sql`
//         INSERT INTO customers (id, name, email, image_url)
//         VALUES (${customer.id}, ${customer.name}, ${customer.email}, ${customer.image_url})
//         ON CONFLICT (id) DO NOTHING;
//       `,
//     ),
//   );

//   return insertedCustomers;
// }

// async function seedRevenue() {
//   await sql`
//     CREATE TABLE IF NOT EXISTS revenue (
//       month VARCHAR(4) NOT NULL UNIQUE,
//       revenue INT NOT NULL
//     );
//   `;

//   const insertedRevenue = await Promise.all(
//     revenue.map(
//       (rev) => sql`
//         INSERT INTO revenue (month, revenue)
//         VALUES (${rev.month}, ${rev.revenue})
//         ON CONFLICT (month) DO NOTHING;
//       `,
//     ),
//   );

//   return insertedRevenue;
// }

// export async function GET() {
//   try {
//     const result = await sql.begin((sql) => [
//       seedUsers(),
//       seedCustomers(),
//       seedInvoices(),
//       seedRevenue(),
//     ]);

//     return Response.json({ message: 'Database seeded successfully' });
//   } catch (error) {
//     return Response.json({ error }, { status: 500 });
//   }
// }

// app/seed/route.ts
import { NextResponse } from 'next/server';
import postgres, { Sql } from 'postgres';
import bcrypt from 'bcrypt';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';

const DB_URL =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (!DB_URL) throw new Error('DB URL not set');

const sql = postgres(DB_URL, { ssl: 'require' });

// Helpers que usan el tx de la transacción
async function seedUsers(tx: Sql) {
  await tx`CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );`;

  await Promise.all(
    users.map(async (u) => {
      const hashed = await bcrypt.hash(u.password, 10);
      await tx`
        INSERT INTO users (id, name, email, password)
        VALUES (${u.id}, ${u.name}, ${u.email}, ${hashed})
        ON CONFLICT (email) DO NOTHING;  -- email es UNIQUE
      `;
    })
  );
}

async function seedCustomers(tx: Sql) {
  await tx`CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    image_url VARCHAR(255) NOT NULL
  );`;

  await Promise.all(
    customers.map((c) => tx`
      INSERT INTO customers (id, name, email, image_url)
      VALUES (${c.id}, ${c.name}, ${c.email}, ${c.image_url})
      ON CONFLICT (id) DO NOTHING;
    `)
  );
}

async function seedInvoices(tx: Sql) {
  await tx`CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID NOT NULL,
    amount INT NOT NULL,
    status VARCHAR(255) NOT NULL,
    date DATE NOT NULL
    -- opcional: , FOREIGN KEY (customer_id) REFERENCES customers(id)
  );`;

  await Promise.all(
    invoices.map((i) => tx`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${i.customer_id}, ${i.amount}, ${i.status}, ${i.date})
      ON CONFLICT (id) DO NOTHING;
    `)
  );
}

async function seedRevenue(tx: Sql) {
  await tx`CREATE TABLE IF NOT EXISTS revenue (
    month VARCHAR(4) NOT NULL UNIQUE,
    revenue INT NOT NULL
  );`;

  await Promise.all(
    revenue.map((r) => tx`
      INSERT INTO revenue (month, revenue)
      VALUES (${r.month}, ${r.revenue})
      ON CONFLICT (month) DO NOTHING;
    `)
  );
}

export async function GET() {
  try {
    // Extensión: solo una vez y fuera del BEGIN
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

    // Una sola transacción y en orden
    await sql.begin(async (tx) => {
      await seedUsers(tx);
      await seedCustomers(tx);
      await seedInvoices(tx);
      await seedRevenue(tx);
    });

    return NextResponse.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
