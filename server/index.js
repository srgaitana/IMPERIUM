import express from "express"
import logger from "morgan"
import dotenv from "dotenv"
import path from "path"
import { Server } from "socket.io"
import { createServer } from "node:http"
import { createClient } from "@libsql/client"

dotenv.config()

const port = process.env.PORT ?? 3000;
const app = express();
const server = createServer(app)
const io = new Server(server,{
    connecctionStateRecovery: {}
})

const db = createClient({
    url: "libsql://my-db-srgaitana.turso.io",
    authToken: process.env.TURSO_AUTH_TOKEN
})

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        content TEXT
    )
    `)


io.on('connection', async (socket)=> {
    console.log('A user has connected!')
    socket.on('disconnect',()=>{
        console.log('An user has disconnected')
    })

    socket.on('chat message', async (msg)=>{
        let result
        try{
            result = await db.execute(
                {
                    sql: `INSERT INTO messages (content) VALUES (:msg)`,
                    args:{msg}
                }
            )
        } catch (e){
            console.error(e)
            return
        }
        io.emit('chat message', msg, result.lastInsertRowid.toString())
    })

    if(!socket.recovered){
        try {
            const results = await db.execute({
                sql:'SELECT id, content FROM messages WHERE id > ?',
                args: [socket.handshake.auth.serverOffseth ?? 0]

            })

            results.rows.forEach(row =>{
                socket.emit('chat message', row.content, row.id.toString())
            })
        } catch (e){
            console.error(e)
            return
        }
    }
})


app.use(logger('dev'));

app.use(express.static(path.join(process.cwd(), 'client')));

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'client', 'index.html'));
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});