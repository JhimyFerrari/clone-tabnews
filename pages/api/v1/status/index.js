function status(request, response) {
  //response.status(200).send("Alunos do curso.dev são pessoas acima da média")
  response.status(200).json({ chave: "valor" });
}

export default status;
