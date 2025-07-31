// Netlify Functions для обробки вибору команд (адаптовано для Render)

  console.log('team-selection.js loaded at', new Date().toISOString());

  const http = require('http');

  const MAX_TEAM_SIZE = 30;
  const TEAMS = ['team1', 'team2', 'team3'];

  let teamData = {
    selections: [],
    counters: { team1: 0, team2: 0, team3: 0 }
  };

  // Функція для отримання IP користувача
  function getUserId(req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const userId = `${ip}_${userAgent.slice(0, 50)}`.replace(/[^a-zA-Z0-9_]/g, '_');
    console.log('Generated userId:', userId);
    return userId;
  }

  // Перевірка чи користувач вже вибрав команду
  function hasUserSelected(userId) {
    const result = teamData.selections.some(selection => 
      selection.userId === userId && selection.status === 'selected'
    );
    console.log('User selected check:', { userId, result });
    return result;
  }

  // Додавання користувача до команди
  function addUserToTeam(teamId, userId) {
    teamData.selections.push({
      teamId,
      userId,
      timestamp: Date.now(),
      status: 'selected'
    });
    teamData.counters[teamId]++;
    console.log('Added user to team:', { teamId, userId, counters: teamData.counters });
  }

  const server = http.createServer((req, res) => {
    console.log('Handler triggered at', new Date().toISOString(), ':', { method: req.method, url: req.url });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS request');
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/?action=getTeamCounts')) {
      console.log('Processing getTeamCounts - data:', JSON.stringify(teamData.counters));
      if (!teamData.counters) {
        console.error('teamData.counters is undefined!');
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'Internal data error' }));
        return;
      }
      const response = {
        success: true,
        teams: teamData.counters,
        timestamp: Date.now()
      };
      console.log('getTeamCounts - response:', JSON.stringify(response));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    if (req.method === 'POST' && req.url === '/?action=selectTeam') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        console.log('Processing selectTeam - start:', body);
        const { team } = JSON.parse(body);
        const userId = getUserId(req);

        if (!TEAMS.includes(team)) {
          console.log('Invalid team:', team);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Невірна команда' }));
          return;
        }

        if (hasUserSelected(userId)) {
          console.log('User already selected:', userId);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Ви вже обрали команду' }));
          return;
        }

        if (teamData.counters[team] >= MAX_TEAM_SIZE) {
          console.log('Team full:', team);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, teamFull: true, teams: teamData.counters, message: 'Команда заповнена' }));
          return;
        }

        addUserToTeam(team, userId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, teamFull: false, teams: teamData.counters, message: `Успішно приєдналися до ${team}` }));
      });
      return;
    }

    console.log('Unknown endpoint:', { method: req.method, url: req.url });
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Endpoint not found' }));
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
