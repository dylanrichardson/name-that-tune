window.join = () => {

  const axios = require('axios');
  const csrf = $('#csrf').val();
  axios.defaults.headers.common = {
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-TOKEN': csrf
  };

  function flashError(text) {
    const html = $.parseHTML(`
      <div class='alert alert-danger fade in'>
        <button class='close' type='button' data-dismiss='alert'>
          <i class='fa fa-times-circle-o'/>
        </button>
        <div>${text}</div>
      </div>`);
    $('#container').prepend(html);
  }

  $('#join').on('submit', event => {
    event.preventDefault();
    const party = $('#party').val();
    const name = $('#name').val();
    sessionStorage.removeItem('party_token_key');
    axios.post('/join', { party, name }).then(({ data, error }) => {
      if (error) {
        flashError(error);
      } else {
        sessionStorage.setItem('party_key', party);
        sessionStorage.setItem('name_key', name);
        sessionStorage.setItem('party_token_key', data.token);
        window.location = `/game/${encodeURIComponent(party)}`;
      }
    });
  });

};
