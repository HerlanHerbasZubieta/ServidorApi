const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const app = express();
app.use(cors());
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: "10mb" }));

const baseD = {
  host: "localhost",
  user: "root",
  password: "",
  database: "restaurante",
  port: "3307",
};

const connection = mysql.createPool(baseD);

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

app.post("/restaurante/cliente", async (req, res) => {
  try {
    const { correo, contraseña } = req.body;
    const values = [correo, contraseña];
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

app.post("/cambioUsuario", async (req, res) => {
  try {
    const { nombre, newNombre, newContraseña } = req.body;
    const params = [newNombre, newContraseña, nombre];
    await runQuery(
      "UPDATE cliente SET nombre = ?, contraseña = ? WHERE nombre = ?",
      params
    );
    res.status(200).send("Usuario cambiado");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/restaurante/registro", async (req, res) => {
  try {
    const { nombre, correo, contraseña, telefono, avatar } = req.body;
    const params = [[nombre, correo, contraseña, telefono, avatar]];
    await runQuery(
      "INSERT INTO cliente (nombre, correo, contraseña, telefono, avatar) VALUES ?",
      [params]
    );
    res.status(200).send("Usuario creado");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/restaurante/comentarios", async (req, res) => {
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

app.post("/detalleCompra", async (req, res) => {
  try {
    const { nombre, direccion, telefono, tarjeta } = req.body;
    const nombresPlatos = req.body.nombresPlatos;
    const totalPrecio = req.body.totalPrecio;
    const fechaEntrega = req.body.fechaEntrega;
    const horaEnvio = req.body.horaEnvio;

    const detalleCompraData = {
      nombre,
      direccion,
      telefono,
      tarjeta,
      nombresPlatos,
      totalPrecio,
      fechaEntrega,
      horaEnvio,
    };

    await runQuery("INSERT INTO detalleCompra SET ?", detalleCompraData);
    res.status(200).send("Compra realizada con éxito");
  } catch (error) {
    res.status(500).send("Error al insertar los datos");
  }
});

app.post("/detalleCompraRestaurante", async (req, res) => {
  try {
    const { nombre, telefono, tarjeta } = req.body;
    const nombresPlatos = req.body.nombresPlatos;
    const totalPrecio = req.body.totalPrecio;
    const fechaCompra = req.body.fechaEntrega;
    const horaCompra = req.body.horaEnvio;
    const tiempoLlegada = req.body.valorCombox;
    const numeroMesa = req.body.numeroMesa;

    const detalleCompraData = {
      numeroMesa,
    tarjeta,
    nombresPlatos,
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

app.get("/comentarios", async (req, res) => {
  try {
    const result = await runQuery("SELECT * FROM comentario");
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(result));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

//mostrar los menu
app.get("/menu", async (req, res) => {
  try {
    const result = await runQuery("SELECT * FROM menu");
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(result));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/menus/:tipo", async (req, res) => {
  try {
    const tipoMenu = req.params.tipo;
    let consulta = "";
  
    // Sanitizar el tipoMenu para evitar inyección de SQL
    const tipoMenuEscaped = mysql.escape(`${tipoMenu}%`);
    if (tipoMenu == "menufrito") {
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
app.get("/correo/:correo", async (req, res) => {
  try {
    const clienteCorreo = req.params.correo;
    const result = await runQuery("SELECT * FROM cliente WHERE correo = ?", [clienteCorreo]);
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
