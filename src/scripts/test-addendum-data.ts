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
    const query = `
      SELECT TOP 5 id_archico, id_ris_examen_canal, nombre, fecha_envio
      FROM RIS_PENDIENTE_ARCHIVO 
    `;
    const result = await pool.request().query(query);
    console.log("Datos de muestra de RIS_PENDIENTE_ARCHIVO:");
    console.table(result.recordset);
    pool.close();
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
