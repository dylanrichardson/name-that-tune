window.join = () => {

  $('#join').on('submit', function(e) {
    e.preventDefault();
    //let csrf = #{_csrf};
    let party = $('#party').val();
    let name = $('#name').val();
    let data = {
      party: party,
      name: name
    };
    sessionStorage.removeItem('party_token_key');
    $.post('/join', data, data => {
      if (data.error) {
        console.log(data.error);
      } else {
        sessionStorage.setItem('party_key', party);
        sessionStorage.setItem('name_key', name);
        sessionStorage.setItem('party_token_key', data.token);
        window.location = '/game/' + encodeURIComponent(party);
      }
    })
  });

}
