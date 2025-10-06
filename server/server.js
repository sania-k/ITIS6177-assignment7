const express = require('express');
const app = express();
const port = 3000;

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');

const axios = require('axios');

const FUNC_URL = 'https://us-east1-itis6177-474223.cloudfunctions.net/say';

app.use(cors());
app.use(express.json());

const options = {
   definition: {
      openapi: '3.0.0',
      info: {
         title: 'Assignment 7 API',
         version: '1.0.0',
      },
      servers: [
         { url: 'http://104.236.55.142:3000' },
      ],
   },
   apis: ['./server.js'],
};
const specs = swaggerJsdoc(options);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));

const mariadb = require('mariadb');
const pool = mariadb.createPool({
   host: 'localhost',
   user: 'root',
   password: 'root',
   port: 3306,
   database: 'sample',
   connectionLimit: 5
});

async function executeDatabaseOperation(sql, params = []) {
   let conn;
   try {
      conn = await pool.getConnection();
      const rows = await conn.query(sql, params);
      return rows;
   } finally {
      if (conn) conn.release();
   }
}

/**
 * @swagger
 * /say:
 *   get:
 *     summary: Forward a keyword to the cloud function and return the response
 *     tags: [Say]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         required: true
 *         description: The keyword to forward to the Cloud Function
 *     responses:
 *       200:
 *         description: Successful response from the Cloud Function
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Sania says 'hello' :D
 *       500:
 *         description: Error calling Cloud Function
 */
app.get('/say', async (req, res) => {
  const keyword = req.query.keyword || '';

  try {
    const response = await axios.get(FUNC_URL, {
      params: { keyword }
    });
    res.send(response.data);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Error calling Cloud Function');
  }
});

/**
 * @swagger
 * /students:
 *   get:
 *     summary: Get all students
 *     tags: [Students]
 *     description: Returns all students from the database
 *     responses:
 *       200:
 *         description: A list of students
 *       500:
 *         description: Server error
 */
app.get('/students', async (req, res) => {
   try {
      const rows = await executeDatabaseOperation(`SELECT * FROM student;`);
      res.json(rows);
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

/**
 * @swagger
 * /companies/agents:
 *   get:
 *     summary: Get all companies and their agents
 *     tags: [Companies]
 *     description: Returns companies and the agents working in their city
 *     responses:
 *       200:
 *         description: A list of companies with their agents
 *       500:
 *         description: Server error
 */
app.get('/companies/agents', async (req, res) => {
   try {
      const rows = await executeDatabaseOperation(`
         SELECT c.COMPANY_ID, c.COMPANY_NAME, c.COMPANY_CITY, a.AGENT_NAME
         FROM company c
         LEFT JOIN agents a
           ON TRIM(REPLACE(c.COMPANY_CITY, '\r', '')) = TRIM(a.WORKING_AREA)
         ORDER BY c.COMPANY_NAME;
      `);

      const companies = {};
      rows.forEach(r => {
         if (!companies[r.COMPANY_ID]) {
            companies[r.COMPANY_ID] = {
               id: r.COMPANY_ID,
               name: r.COMPANY_NAME?.trim(),
               city: r.COMPANY_CITY?.replace(/\r/g, '').trim(),
               agents: []
            };
         }
         if (r.AGENT_NAME) {
            companies[r.COMPANY_ID].agents.push(r.AGENT_NAME.trim());
         }
      });

      res.json(Object.values(companies));
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

/**
 * @swagger
 * /companies/customers:
 *   get:
 *     summary: Get all companies and their customers
 *     tags: [Companies]
 *     description: Returns companies and the customers located in their city
 *     responses:
 *       200:
 *         description: A list of companies with their customers
 *       500:
 *         description: Server error
 */
app.get('/companies/customers', async (req, res) => {
   try {
      const rows = await executeDatabaseOperation(`
         SELECT c.COMPANY_ID, c.COMPANY_NAME, c.COMPANY_CITY, cu.CUST_NAME
         FROM company c
         LEFT JOIN customer cu
           ON TRIM(REPLACE(c.COMPANY_CITY, '\r', '')) = TRIM(cu.CUST_CITY)
         ORDER BY c.COMPANY_NAME;
      `);

      const companies = {};
      rows.forEach(r => {
         if (!companies[r.COMPANY_ID]) {
            companies[r.COMPANY_ID] = {
               id: r.COMPANY_ID,
               name: r.COMPANY_NAME?.trim(),
               city: r.COMPANY_CITY?.replace(/\r/g, '').trim(),
               customers: []
            };
         }
         if (r.CUST_NAME) {
            companies[r.COMPANY_ID].customers.push(r.CUST_NAME.trim());
         }
      });

      res.json(Object.values(companies));
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

/**
 * @swagger
 * /agents:
 *   get:
 *     summary: Get all agents
 *     tags: [Agents]
 *     description: Returns all agents from the database
 *     responses:
 *       200:
 *         description: A list of agents
 *       500:
 *         description: Server error
 */
app.get('/agents', async (req, res) => {
   try {
      const rows = await executeDatabaseOperation(`SELECT * FROM agents;`);
      res.json(rows);
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

/**
 * @swagger
 * /agents/create:
 *   post:
 *     summary: Create a new agent
 *     tags: [Agents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - AGENT_CODE
 *               - AGENT_NAME
 *               - WORKING_AREA
 *               - COMMISSION
 *             properties:
 *               AGENT_CODE:
 *                 type: string
 *                 example: A011
 *               AGENT_NAME:
 *                 type: string
 *                 example: John Doe
 *               WORKING_AREA:
 *                 type: string
 *                 example: New York
 *               COMMISSION:
 *                 type: number
 *                 example: 0.15
 *               PHONE_NO:
 *                 type: string
 *                 example: 123-456-7890
 *               COUNTRY:
 *                 type: string
 *                 example: USA
 *     responses:
 *       201:
 *         description: Agent created successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
app.post('/agents/create', async (req, res) => {
   try {
      let { AGENT_CODE, AGENT_NAME, WORKING_AREA, COMMISSION, PHONE_NO, COUNTRY } = req.body;

      AGENT_CODE = AGENT_CODE?.trim();
      AGENT_NAME = AGENT_NAME?.trim();
      WORKING_AREA = WORKING_AREA?.trim();
      COMMISSION = parseFloat(COMMISSION);
      PHONE_NO = PHONE_NO?.trim();
      COUNTRY = COUNTRY?.trim();

      if (!AGENT_CODE || !AGENT_NAME || !WORKING_AREA || isNaN(COMMISSION)) {
         return res.status(400).json({ error: 'Missing or invalid fields' });
      }

      await executeDatabaseOperation(
         `INSERT INTO agents (AGENT_CODE, AGENT_NAME, WORKING_AREA, COMMISSION, PHONE_NO, COUNTRY) 
          VALUES (?, ?, ?, ?, ?, ?)`,
         [AGENT_CODE, AGENT_NAME, WORKING_AREA, COMMISSION, PHONE_NO, COUNTRY]
      );

      res.status(201).json({ message: 'Agent created successfully' });
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

/**
 * @swagger
 * /agents/{id}:
 *   patch:
 *     summary: Partially update an agent
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               PHONE_NO:
 *                 type: string
 *                 example: 987-654-3210
 *               COMMISSION:
 *                 type: number
 *                 example: 0.20
 *     responses:
 *       200:
 *         description: Agent updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Agent not found
 *       500:
 *         description: Server error
 */
app.patch('/agents/:id', async (req, res) => {
   try {
      const { id } = req.params;
      let { PHONE_NO, COMMISSION } = req.body;

      if (!PHONE_NO && COMMISSION == null) {
         return res.status(400).json({ error: 'Nothing to update' });
      }

      const fields = [];
      const values = [];

      if (PHONE_NO) {
         fields.push("PHONE_NO = ?");
         values.push(PHONE_NO.trim());
      }
      if (COMMISSION != null) {
         fields.push("COMMISSION = ?");
         values.push(parseFloat(COMMISSION));
      }

      values.push(id);

      const result = await executeDatabaseOperation(
         `UPDATE agents SET ${fields.join(', ')} WHERE AGENT_CODE = ?`,
         values
      );

      if (result.affectedRows === 0) return res.status(404).json({ error: 'Agent not found' });
      res.json({ message: 'Agent updated successfully' });
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

/**
 * @swagger
 * /agents/{id}:
 *   put:
 *     summary: Replace an agent
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - AGENT_NAME
 *               - WORKING_AREA
 *               - COMMISSION
 *             properties:
 *               AGENT_NAME:
 *                 type: string
 *                 example: Jane Smith
 *               WORKING_AREA:
 *                 type: string
 *                 example: London
 *               COMMISSION:
 *                 type: number
 *                 example: 0.25
 *               PHONE_NO:
 *                 type: string
 *                 example: 555-123-4567
 *               COUNTRY:
 *                 type: string
 *                 example: UK
 *     responses:
 *       200:
 *         description: Agent replaced successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Agent not found
 *       500:
 *         description: Server error
 */
app.put('/agents/:id', async (req, res) => {
   try {
      const { id } = req.params;
      let { AGENT_NAME, WORKING_AREA, COMMISSION, PHONE_NO, COUNTRY } = req.body;

      if (!AGENT_NAME || !WORKING_AREA || isNaN(parseFloat(COMMISSION))) {
         return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await executeDatabaseOperation(
         `UPDATE agents SET AGENT_NAME=?, WORKING_AREA=?, COMMISSION=?, PHONE_NO=?, COUNTRY=? WHERE AGENT_CODE=?`,
         [AGENT_NAME.trim(), WORKING_AREA.trim(), parseFloat(COMMISSION), PHONE_NO?.trim(), COUNTRY?.trim(), id]
      );

      if (result.affectedRows === 0) return res.status(404).json({ error: 'Agent not found' });
      res.json({ message: 'Agent replaced successfully' });
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

/**
 * @swagger
 * /agents/{id}:
 *   delete:
 *     summary: Delete an agent
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent code
 *     responses:
 *       200:
 *         description: Agent deleted successfully
 *       404:
 *         description: Agent not found
 *       500:
 *         description: Server error
 */
app.delete('/agents/:id', async (req, res) => {
   try {
      const { id } = req.params;
      const result = await executeDatabaseOperation(
         `DELETE FROM agents WHERE AGENT_CODE=?`, [id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Agent not found' });
      res.json({ message: 'Agent deleted successfully' });
   } catch (err) {
      res.status(500).json({ error: err.message });
   }
});

app.listen(port, () => {
   console.log(`App listening at http://localhost:${port}`)
});
