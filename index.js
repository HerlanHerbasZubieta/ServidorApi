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
app.use(responseTime());

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

// Middleware para manejar el almacenamiento en caché con Redis
function checkCache(req, res, next) {
  const key = req.originalUrl;
  redisClient.get(key, (err, data) => {
    if (err) {
      console.error("Error en Redis:", err);
      next();
    } else if (data !== null) {
      console.log("Datos almacenados en Redis:", data);
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

app.post("/addFavorite", async (req, res) => {
  try {
    const { idMenu, idCliente } = req.body;
    const params = [[idMenu, idCliente]];
    await runQuery("INSERT INTO favoritoorden ( idMenu, idCliente ) VALUES ?", [
      params,
    ]);
    res.status(200).send("Orden favorito agregado");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/deleteFavorite/:nameFavorite", async (req, res) => {
  try {
    const nameFavorite = req.params.nameFavorite;
    
    await runQuery("DELETE FROM favoritoorden WHERE idMenu IN (SELECT idMenu FROM menu WHERE nombreMenu = ?)", nameFavorite);
    
    res.status(200).send("Orden favorito eliminado");
  } catch (error) {
    res.status(500).send(error.message);
  }
});


app.post("/detailBuyDelivery", async (req, res) => {
  try {
    const { name, addres, phone, numberCard, orderNames, totalPrice, date, hour, idClient } = req.body;
    const purchaseData = {
      nombre: name,
      direccion: addres,
      telefono: phone,
      tarjeta: numberCard,
      nombresOrden: orderNames,
      totalPrecio: totalPrice,
      fechaEntrega: date,
      horaEnvio: hour,
      idCliente: idClient,
    };

    await runQuery("INSERT INTO detalleCompraDelivery SET ?", purchaseData);

    res.status(200).send("Purchase completed successfully");
  } catch (error) {
    res.status(500).send("Error inserting data");
  }
});

app.post("/detailPurchaseRestaurant", async (req, res) => {
  try {
    const { numberTable, numberCard, orderNames, valueCombox, date, hour, phone, name, totalPrice, idClient } = req.body;
    const purchaseData = {
      numeroMesa: numberTable,
      tarjeta: numberCard,
      nombresOrden: orderNames,
      tiempoLlegada: valueCombox,
      fechaCompra: date,
      horaCompra: hour,
      telefono: phone,
      nombre: name,
      totalPrecio: totalPrice,
      idCliente: idClient,
    };

    await runQuery("INSERT INTO detallecomprarestaurante SET ?", purchaseData);

    res.status(200).send("Purchase completed successfully");
  } catch (error) {
    res.status(500).send("Error inserting data");
  }
});

app.get("/comments", checkCache, async (req, res) => {
  try {
    const result = await runQuery("SELECT * FROM comentario");
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(result));

    // Almacena en caché los resultados en Redis
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
    const result = await runQuery("SELECT * FROM menu");
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(result));

    // Guarda en caché el resultado en Redis
    redisClient.setex(req.originalUrl, 3600, JSON.stringify(result));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/favoritesOrders/:idClient", async (req, res) => {
  try {
    const idClient = req.params.idClient;

    // Consulta la base de datos directamente sin verificar la caché
    const result = await runQuery(
      "SELECT m.nombreMenu, m.imagen, m.descripcionMenu FROM favoritoorden fo JOIN menu m ON fo.idMenu = m.idMenu WHERE fo.idCliente = ?",
      [idClient]
    );

    // Devuelve los datos obtenidos de la base de datos
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(result));
  } catch (error) {
    res.status(500).send(error.message);
  }
});




app.get("/record/:idClient", checkCache, async (req, res) => {
  try {
    const idClient = req.params.idClient;
    const cacheKey = `historial:${idClient}`;

    const [consulta1, consulta2] = await Promise.all([
      runQuery(
        "SELECT dd.idCompra, dd.fechaCompra, dd.horaCompra, dd.nombresOrden, dd.numeroMesa, dd.tiempoLlegada, dd.totalPrecio, c.nombre  FROM cliente c JOIN detallecomprarestaurante dd ON c.idCliente = dd.idCliente WHERE c.idCliente = ?",
        idClient
      ),
      runQuery(
        "SELECT dd.idCompra, dd.fechaEntrega, dd.horaEnvio, dd.nombresOrden, dd.direccion, dd.totalPrecio, c.nombre  FROM cliente c JOIN detallecompradelivery dd ON c.idCliente = dd.idCliente WHERE c.idCliente = ?",
        idClient
      ),
    ]);

    const consultas = {
      compraRestaurante: consulta1,
      compraDelivery: consulta2,
    };

    const responseData = JSON.stringify(consultas);
    redisClient.setex(cacheKey, 3600, responseData);
    res.json(consultas);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/menus/:tipo", checkCache, async (req, res) => {
  try {
    const tipoMenu = req.params.tipo;
    const consulta =
      tipoMenu === "menuFried"
        ? "SELECT * FROM menu WHERE nombreMenu NOT LIKE '%sopa%' AND nombreMenu NOT LIKE '%jugo%' AND nombreMenu NOT LIKE '%desayuno%' AND nombreMenu NOT LIKE '%postre%'"
        : "SELECT * FROM menu WHERE nombreMenu LIKE ?";

    const result = await runQuery(consulta, [`${tipoMenu}%`]);

    // Guardar los datos en caché en Redis
    const cacheKey = req.originalUrl;
    const cacheDuration = 3600;
    redisClient.setex(cacheKey, cacheDuration, JSON.stringify(result));

    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(result));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/email/:email", checkCache, async (req, res) => {
  try {
    const clientCorreo = req.params.email;
    const key = req.originalUrl;

    redisClient.get(key, async (err, cachedData) => {
      if (err) {
        console.error("Error en Redis:", err);
        next();
      } else if (cachedData !== null) {
        console.log("Datos almacenados en Redis:", cachedData);
        res.setHeader("Content-Type", "application/json");
        res.status(200).send(cachedData);
      } else {
        const result = await runQuery(
          "SELECT * FROM cliente WHERE correo = ?",
          [clientCorreo]
        );

        if (result.length > 0) {
          res.status(200).json(result);
          redisClient.setex(key, 3600, JSON.stringify(result), (err) => {
            if (err) {
              console.error("Error al almacenar en caché:", err);
            }
          });
        } else {
          res.status(404).send("Cliente no encontrado");
        }
      }
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/delete-key/email/:key", (req, res) => {
  let deleteKey = "/email/" + req.params.key;

  redisClient.del(deleteKey, (err, reply) => {
    if (err) {
      res.status(500).json({ message: "Error al eliminar la clave." });
    } else {
      if (reply === 1) {
        res.json({ message: "Clave eliminada correctamente." });
      } else {
        res.json({ message: "La clave no existe en Redis." });
      }
    }
  });
});

process.on("exit", () => {
  redisClient.quit(); // Cerrar la conexión de forma segura
});

app.listen(4000, () => console.log("Servidor iniciado en el puerto 4000"));
