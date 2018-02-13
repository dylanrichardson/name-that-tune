window.newGame = () => {

  $('#new-game').on('submit', _ => {
    const party = $('#party').val();
    const name = $('#name').val();
    sessionStorage.setItem('party_key', party);
    sessionStorage.setItem('name_key', name);
    sessionStorage.removeItem('party_token_key');
  });

};
