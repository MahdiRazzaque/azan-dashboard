let clients = [];

const addClient = (res) => {
    // Send initial ping or retry info
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.write('retry: 10000\n\n');
    
    clients.push(res);
    
    res.on('close', () => {
        clients = clients.filter(c => c !== res);
    });
};

const broadcast = (data) => {
    clients.forEach(client => {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
};

module.exports = { addClient, broadcast };
