window.newGame = () => {

  $('#new-game').on('submit', function(e) {
    let party = $('#party').val();
    let name = $('#name').val();
    sessionStorage.setItem('party_key', party);
    sessionStorage.setItem('name_key', name);
    sessionStorage.removeItem('party_token_key');
  });

}
