window.join = () => {

  const axios = require('axios');
  const csrf = $('#csrf').val();
  axios.defaults.headers.common = {
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-TOKEN': csrf
  };

  $('#join').on('submit', event => {
    event.preventDefault();
    const party = $('#party').val();
    const name = $('#name').val();
    sessionStorage.removeItem('party_token_key');
    axios.post('/join', { party, name }).then(({ data }) => {
      if (data.error) {
        console.log(data.error);
      } else {
        sessionStorage.setItem('party_key', party);
        sessionStorage.setItem('name_key', name);
        sessionStorage.setItem('party_token_key', data.token);
        window.location = `/game/${encodeURIComponent(party)}`;
      }
    });
  });

};
