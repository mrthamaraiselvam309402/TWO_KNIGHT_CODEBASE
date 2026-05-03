// Chessboard replay for Immortal Game
// Requires chess.js library (add <script src="https://cdn.jsdelivr.net/npm/chess.js"></script> to HTML)

let chess = null;
let currentMoveIndex = 0;
const immortalMoves = [
  'e4', 'e5', 'f4', 'exf4', 'Bc4', 'Qh4+', 'Kf1', 'b5', 'Bxb5', 'Nf6',
  'Nf3', 'Qh6', 'd3', 'Nh5', 'Nh4', 'Qg5', 'Nf5', 'c6', 'g4', 'Nf6',
  'Rg1', 'cxb5', 'h4', 'Qg6', 'h5', 'Qg5', 'Qf3', 'Ng8', 'Bxf4', 'Qf6',
  'Nc3', 'Bc5', 'Nd5', 'Qxb2', 'Bd6', 'Qxa1+', 'Ke2', 'Na6', 'Nxg7+', 'Kd8',
  'Qf6+', 'Nxf6', 'Be7#'
];

function initChessboard() {
  if (typeof Chess === 'undefined') {
    console.error('Chess.js library not loaded');
    return;
  }
  chess = new Chess();
  renderBoard();
  document.getElementById('moveCounter').textContent = `Move 0/${immortalMoves.length}`;
}

function renderBoard() {
  const boardEl = document.getElementById('chessboard');
  if (!boardEl) return;
  boardEl.innerHTML = '';
  const board = chess.board();
  for (let row = 7; row >= 0; row--) {
    for (let col = 0; col < 8; col++) {
      const square = board[row][col];
      const piece = square ? getPieceSymbol(square) : '';
      const squareEl = document.createElement('div');
      squareEl.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
      squareEl.innerHTML = piece;
      boardEl.appendChild(squareEl);
    }
  }
}

function getPieceSymbol(piece) {
  const symbols = {
    'p': '♟', 'r': '♜', 'n': '♞', 'b': '♗', 'q': '♛', 'k': '♚',
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
  };
  return symbols[piece.type] || '';
}

function playMove() {
  if (currentMoveIndex < immortalMoves.length) {
    const move = chess.move(immortalMoves[currentMoveIndex]);
    if (move) {
      renderBoard();
      currentMoveIndex++;
      document.getElementById('moveCounter').textContent = `Move ${currentMoveIndex}/${immortalMoves.length}`;
      document.getElementById('currentMove').textContent = immortalMoves[currentMoveIndex - 1];
    }
  }
}

function prevMove() {
  if (currentMoveIndex > 0) {
    chess.undo();
    currentMoveIndex--;
    renderBoard();
    document.getElementById('moveCounter').textContent = `Move ${currentMoveIndex}/${immortalMoves.length}`;
    document.getElementById('currentMove').textContent = currentMoveIndex > 0 ? immortalMoves[currentMoveIndex - 1] : 'Start';
  }
}

function resetBoard() {
  chess.reset();
  currentMoveIndex = 0;
  renderBoard();
  document.getElementById('moveCounter').textContent = `Move 0/${immortalMoves.length}`;
  document.getElementById('currentMove').textContent = 'Start';
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('chessboard')) {
    initChessboard();
  }
});