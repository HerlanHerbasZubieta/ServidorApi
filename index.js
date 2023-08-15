const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const app = express();
const redis = require("redis");
const responseTime = require("response-time");
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(cors());
app.use(responseTime())


const baseD = {
  host: "localhost",
  user: "root",
  password: "",
  database: "restaurante",
  port: "3307",
};

const connection = mysql.createPool(baseD);
const redisClient = redis.createClient();

// Función para ejecutar una consulta en la base de datos
function runQuery(sql, params) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// Manejar errores de conexión a Redis
redisClient.on("error", (err) => {
  console.error("Error en Redis:", err);
});

// Middleware para manejar el almacenamiento en caché con Redis
function checkCache(req, res, next) {
  const key = req.originalUrl;
  redisClient.get(key, (err, data) => {
    if (err) {
      console.error("Error en Redis:", err);
      next();
    } else if (data !== null) {
      console.log("Datos almacenados en Redis:", data)
      res.setHeader("Content-Type", "application/json");
      res.status(200).send(data);
    } else {
      next();
    }
  });
}

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const values = [email, password];
    const result = await runQuery(
      "SELECT * FROM cliente WHERE correo = ? AND contraseña = ?",
      values
    );

    if (result.length > 0) {
      res.status(200).send("Usuario encontrado");
    } else {
      res.status(400).send("Cliente no existe");
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});


app.post("/changeUser", async (req, res) => {
  try {
    const { name, newName, newPassword } = req.body;
    const params = [newName, newPassword, name];
    await runQuery(
      "UPDATE cliente SET nombre = ?, contraseña = ? WHERE nombre = ?",
      params
    );
    res.status(200).send("Usuario cambiado con exito");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, avatar } = req.body;
    const params = [[name, email, password, phone, avatar]];
    await runQuery(
      "INSERT INTO cliente (nombre, correo, contraseña, telefono, avatar) VALUES ?",
      [params]
    );
    res.status(200).send("Usuario creado");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/addComments", async (req, res) => {
  try {
    const { avatar, nombre, fechaYhora, comentario } = req.body;
    const params = [[avatar, nombre, fechaYhora, comentario]];
    await runQuery(
      "INSERT INTO comentario (avatar, nombre, fechaYhora, comentario) VALUES ?",
      [params]
    );
    res.status(200).send("Comentario agregado");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/detailBuyDelivery", async (req, res) => {
  try {
    const { nombre, direccion, telefono, tarjeta } = req.body;
    const nombresOrden = req.body.nombresOrden;
    const totalPrecio = req.body.totalPrice;
    const fechaEntrega = req.body.fechaEntrega;
    const horaEnvio = req.body.horaEnvio;

    const detalleCompraData = {
      nombre,
      direccion,
      telefono,
      tarjeta,
      nombresOrden,
      totalPrecio,
      fechaEntrega,
      horaEnvio,
    };

    await runQuery(
      "INSERT INTO detalleCompraDelivery SET ?",
      detalleCompraData
    );
    res.status(200).send("Compra realizada con éxito");
  } catch (error) {
    res.status(500).send("Error al insertar los datos");
  }
});

app.post("/detailPurchaseRestaurant", async (req, res) => {
  try {
    const { nombre, telefono, tarjeta } = req.body;
    const nombresOrden = req.body.nombresOrden;
    const totalPrecio = req.body.totalPrice;
    const fechaCompra = req.body.fechaEntrega;
    const horaCompra = req.body.horaEnvio;
    const tiempoLlegada = req.body.valorCombox;
    const numeroMesa = req.body.numeroMesa;

    const detalleCompraData = {
      numeroMesa,
      tarjeta,
      nombresOrden,
      tiempoLlegada,
      fechaCompra,
      horaCompra,
      telefono,
      nombre,
      totalPrecio,
    };

    await runQuery(
      "INSERT INTO detallecomprarestaurante SET ?",
      detalleCompraData
    );
    res.status(200).send("Compra realizada con éxito");
  } catch (error) {
    res.status(500).send("Error al insertar los datos");
  }
});

app.get("/comments", checkCache, async (req, res) => {
  try {
    const result = await runQuery("SELECT * FROM comentario");
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(result));

    // Almacenar en caché los resultados en Redis
    const key = req.originalUrl;
    redisClient.setex(key, 60, JSON.stringify(result), (err) => {
      if (err) {
        console.error("Error al almacenar en caché:", err);
      }
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});


app.get("/menu", checkCache, async (req, res) => {
  try {
    // Aquí deberías definir la función runQuery para obtener los datos de la base de datos
    const result = await runQuery("SELECT * FROM menu");
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(result));

    // Guardar en caché el resultado en Redis
    redisClient.setex(req.originalUrl, 3600, JSON.stringify(result));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Cerrar la conexión a Redis cuando la aplicación se apaga
process.on("exit", () => {
  redisClient.quit(); // Cerrar la conexión de forma segura
});

app.get("/historial/:cliente", async (req, res) => {
  try {
    const nombreCliente = req.params.cliente;
    const [consulta1, consulta2] = await Promise.all([
      runQuery(
        "SELECT * FROM detallecomprarestaurante WHERE nombre = ?",
        nombreCliente
      ),
      runQuery(
        "SELECT * FROM detallecompradelivery WHERE nombre = ?",
        nombreCliente
      ),
    ]);

    const consultas = {
      compraRestaurante: consulta1,
      compraDelivery: consulta2,
    };

    res.json(consultas);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/menus/:tipo", async (req, res) => {
  try {
    const tipoMenu = req.params.tipo;
    let consulta = "";

    const tipoMenuEscaped = mysql.escape(`${tipoMenu}%`);
    if (tipoMenu == "friedmenu") {
      consulta =
        "SELECT * FROM menu WHERE nombreMenu NOT LIKE '%sopa%' AND nombreMenu NOT LIKE '%jugo%' AND nombreMenu NOT LIKE '%desayuno%' AND nombreMenu NOT LIKE '%postre%'";
    } else {
      consulta = "SELECT * FROM menu WHERE nombreMenu LIKE " + tipoMenuEscaped;
    }

    const result = await runQuery(consulta);
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(result));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

//buscar por correo al cliente
app.get("/email/:email", async (req, res) => {
  try {
    const clientCorreo = req.params.email;
    const result = await runQuery("SELECT * FROM cliente WHERE correo = ?", [
      clientCorreo,
    ]);
    if (result.length > 0) {
      res.status(200).json(result[0]); // Devuelve el primer cliente encontrado
    } else {
      res.status(404).send("Cliente no encontrado");
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(4000, () => console.log("Servidor iniciado en el puerto 4000"));
