import { Sequelize } from "sequelize";
import { sequelize } from "./models/db.js";
import { User } from "./models/userModel.js";
import inquirer from "inquirer";

const dbName = "online_booking";

const rootSequelize = new Sequelize(
  "mysql",
  "root",
  "",
  {
    host: "127.0.0.1",
    dialect: "mysql",
    port: 3306,
    logging: false
  }
);

try {
  const { createDb } = await inquirer.prompt([
    {
      type: "confirm",
      name: "createDb",
      message: `Database '${dbName}' may not exist. Create it?`,
      default: true
    }
  ]);

  if (createDb) {
    await rootSequelize.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`
    );

    console.log("Database created (if it did not exist).");
  }

  await sequelize.authenticate();

  console.log("Connected to MySQL database!");

  await sequelize.sync();

  console.log("Database tables synchronized successfully!");

} catch (error) {
  console.error("Migration failed:", error.message);

} finally {
  await rootSequelize.close();
  await sequelize.close();
}