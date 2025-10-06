exports.say = (req, res) => {
  const keyword = req.query.keyword || req.body?.keyword;
  if (!keyword) {
    res.status(400).send('Missing query parameter: keyword');
    return;
  }
  res.status(200).send(`Sania says '${keyword}' :D`);
};
