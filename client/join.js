window.join = () => {

  $('#join').on('submit', event => {
    event.preventDefault();
    const csrf = $('#csrf').val();
    const party = $('#party').val();
    const name = $('#name').val();
    sessionStorage.removeItem('party_token_key');
    $.post('/join', { party, name }, data => {
      if (data.error) {
        console.log(data.error);
      } else {
        sessionStorage.setItem('party_key', party);
        sessionStorage.setItem('name_key', name);
        sessionStorage.setItem('party_token_key', data.token);
        window.location = '/game/' + encodeURIComponent(party);
      }
    });
  });

};
