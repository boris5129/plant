#!/usr/bin/perl
use strict;
use warnings;
use FindBin qw($Bin);
use IO::Select;
use IO::Socket::INET;

my %types = (
    'index.html' => 'text/html; charset=utf-8',
    'style.css' => 'text/css; charset=utf-8',
    'plant-fit-template.xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'JSZip-LICENSE.markdown' => 'text/plain; charset=utf-8',
    map { $_ => 'text/javascript; charset=utf-8' } qw(
        app.js care.js catalog.js growth.js jszip.min.js original-data.js photos.js workbook.js
    )
);
my $port = $ENV{PLANT_FIT_PORT} // 4187;
die "Invalid PLANT FIT port.\n" unless $port =~ /\A\d{1,5}\z/ && $port > 0 && $port <= 65535;
my $host = "127.0.0.1:$port";
my $url = "http://$host/";
my $server = IO::Socket::INET->new(
    LocalAddr => '127.0.0.1', LocalPort => $port, Listen => 16, ReuseAddr => 1
) or die "Could not start PLANT FIT on $url. Is another local server open?\n";

$| = 1;
$SIG{PIPE} = 'IGNORE';
print "PLANT FIT: $url\nKeep this Terminal window open. Press Control-C to stop.\n";
if ($^O eq 'darwin' && !grep { $_ eq '--no-open' } @ARGV) {
    if (-d '/Applications/Google Chrome.app' || (defined $ENV{HOME} && -d "$ENV{HOME}/Applications/Google Chrome.app")) {
        system('/usr/bin/open', '-a', 'Google Chrome', $url);
    } else {
        system('/usr/bin/open', $url);
    }
}

sub reply {
    my ($client, $status, $type, $body, $head) = @_;
    my $header = "HTTP/1.1 $status\r\nConnection: close\r\nContent-Type: $type\r\n"
        . 'Content-Length: ' . length($body) . "\r\nCache-Control: no-store\r\n"
        . "X-Plant-Fit: local\r\nX-Content-Type-Options: nosniff\r\n\r\n";
    print {$client} $header, ($head ? '' : $body);
}

sub serve {
    my ($client) = @_;
    binmode($client, ':raw');
    my $ready = IO::Select->new($client);
    my $request = '';
    while (length($request) < 8192 && $request !~ /\r\n\r\n/) {
        return unless $ready->can_read(2);
        my $count = sysread($client, my $chunk, 2048);
        return unless $count;
        $request .= $chunk;
    }
    my ($method, $target) = $request =~ /\A([A-Z]+) ([^ ]+) HTTP\/1\.[01]\r\n/;
    return reply($client, '400 Bad Request', 'text/plain', '', 0)
        unless defined($method) && $request =~ /\r\nHost:[ \t]*\Q$host\E[ \t]*\r\n/i
          && length($request) <= 8192 && $request =~ /\r\n\r\n/;
    my $head = $method eq 'HEAD';
    return reply($client, '405 Method Not Allowed', 'text/plain', '', 0) unless $head || $method eq 'GET';
    $target =~ s/\?.*\z//;
    my $name = $target eq '/' ? 'index.html' : substr($target, 1);
    return reply($client, '404 Not Found', 'text/plain', '', $head) unless exists($types{$name});
    open(my $file, '<:raw', "$Bin/$name") or return reply($client, '500 Internal Server Error', 'text/plain', '', $head);
    local $/;
    my $body = <$file> // '';
    close($file);
    reply($client, '200 OK', $types{$name}, $body, $head);
}

while (my $client = $server->accept()) {
    serve($client);
    close($client);
}
