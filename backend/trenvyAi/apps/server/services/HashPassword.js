import bcrypt from "bcrypt";

const saltRounds = 10; // 10–12 is enough — 22 is unnecessarily heavy

export async function hashPassword(password) {
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        return hash;
    } catch (err) {
        console.error("Error hashing password:", err);
        throw err;
    }
}
