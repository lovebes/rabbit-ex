defmodule Rabbit.VideoChannel do
  use Phoenix.Channel

  def join("video:" <> stream_id, _message, socket) do
    {:ok, socket}
  end

  def handle_in("play", %{"currentTime" => time}, socket) do
    broadcast_from! socket, "play", %{currentTime: time}
    {:noreply, socket}
  end

  def handle_in("pause", %{"currentTime" => time}, socket) do
    broadcast_from! socket, "pause", %{currentTime: time}
    {:noreply, socket}
  end

  def handle_in("time_update", %{"currentTime" => time}, socket) do
    broadcast_from! socket, "time_update", %{currentTime: time}
    {:noreply, socket}
  end

  def handle_in("caption_update", %{"caption" => caption}, socket) do
    broadcast_from! socket, "caption_update", %{caption: caption}
    {:noreply, socket}
  end

end
