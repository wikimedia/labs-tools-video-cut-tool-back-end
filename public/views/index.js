<!-- views/index.ejs -->
<meta charset="utf-8">
<h3>VideoCutTool tool</h3>
<% if(user) { %>
  Greetings, <%= user.displayName %>! <a href="<%= url %>/logout">Click to logout</a>
<% } else { %>
  <a href="<%= url %>/login">Click here to login</a>
<% } %>


