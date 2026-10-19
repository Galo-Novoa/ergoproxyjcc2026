import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
await c.connect();
const u = (await c.query(`select id,email from "user" where email like 'prisma.test.%' order by "createdAt" desc limit 1`)).rows[0];
if(!u){console.log("NO USER");process.exit(1)}
const s = (await c.query('insert into subjects (user_id,name) values ($1,$2) returning id',[u.id,"Borrar con datos"])).rows;
const sid=s[0].id;
await c.query("insert into files (user_id,subject_id,name,mime_type,size_bytes,status) values ($1,$2,'prueba.pdf','application/pdf',10,'ready')",[u.id,sid]);
await c.query("insert into conversations (user_id,subject_id,title) values ($1,$2,'Conv de prueba')",[u.id,sid]);
console.log("SUBJECT_ID="+sid, "EMAIL="+u.email);
await c.end();
