import sql from 'mssql';

async function main() {
  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST || '',
    database: process.env.DB_NAME,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      requestTimeout: 15000,
    },
  };

  try {
    const pool = await sql.connect(config);
    console.log("Conectado a la base de datos VPN");

    const tablesQuery = `
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME IN ('SolicitudAddemdum', 'RIS_PENDIENTE_ARCHIVO')
      ORDER BY TABLE_NAME, COLUMN_NAME
    `;
    const tablesResult = await pool.request().query(tablesQuery);
    console.log("\n==================================");
    console.log("Tablas y Columnas:");
    console.table(tablesResult.recordset);
    pool.close();
  } catch (err) {
    console.error("Error reconociendo la base de datos:", err);
  }
}

main();
