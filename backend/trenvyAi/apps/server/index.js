import express from "express";
import dotenv from "dotenv";;
dotenv.config();
import indexrouter from"./routes/index.js";
const app = express();
app.use(express.json());
app.use('/api/v1', indexrouter);
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
})
