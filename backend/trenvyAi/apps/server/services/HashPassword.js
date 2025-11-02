import bcrypt from "bcrypt";

const saltRounds = 10;
export async function hashPassword(password) {
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        return hash;
    } catch (err) {
        console.error("Error hashing password:", err);
        throw err;
    }
}
export async function comparepassword(password){
    try{
        bcrypt.compare(plainPasswordFromUser, hashedPasswordFromDb, function(err, result) {
            if (err) {
                console.error("Error during password comparison:", err);
                return;
            }
            if (result) {
                console.log("Password is correct!");
                // User authenticated successfully
                return true;
            } else {
                console.log("Password is incorrect!");
                // Authentication failed
                return false;
            }
        });
    }catch(err){
        console.error("Error hashing password:", err);
        throw err;
    }
}
